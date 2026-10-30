import { describe, expect, it } from "vitest";
import {
  detectEvents,
  drawEffects,
  type Effect,
  FX,
  type FxEvent,
  type FxKind,
  MAX_EFFECTS,
  MAX_SHAKE,
  particleCount,
  shakeAt,
  updateEffects,
} from "../../src/render/effects";
import { TILE_PX } from "../../src/render/canvas";
import { prngInt } from "../../src/sim/prng";
import { SUB } from "../../src/sim/rules";
import type { GameState } from "../../src/sim/state";
import { newMonk } from "../../src/sim/state";
import { stateFrom, withPlayer } from "../sim/helpers";

const KINDS = Object.keys(FX) as FxKind[];

/** A level with gold, an exit and a runner on the floor. */
function base(): GameState {
  return stateFrom(["$..E..P.", "########"]);
}

/** `s` one tick later, changed by `patch`. */
function later(s: GameState, patch: Partial<GameState> = {}): GameState {
  return { ...s, tick: s.tick + 1, ...patch };
}

const centre = (cx: number, cy: number): { x: number; y: number } => ({
  x: (cx + 0.5) * TILE_PX,
  y: (cy + 0.5) * TILE_PX,
});

/** A context that counts fills, flashes ("lighter" with a gradient) and translations. */
function recorder(): { ctx: CanvasRenderingContext2D; fills: () => number; flashes: () => number } {
  let fills = 0;
  let flashes = 0;
  let fillStyle: unknown = "";
  const target: Record<string, unknown> = {
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v: unknown) {
      fillStyle = v;
    },
    fillRect() {
      if (typeof fillStyle === "object") flashes++;
      else fills++;
    },
    createRadialGradient: () => ({ addColorStop() {} }),
    save() {},
    restore() {},
  };
  return {
    ctx: target as unknown as CanvasRenderingContext2D,
    fills: () => fills,
    flashes: () => flashes,
  };
}

describe("detectEvents", () => {
  it("finds nothing between a state and itself, or an earlier one (a restart)", () => {
    const s = base();
    expect(detectEvents(s, s)).toEqual([]);
    const dug = later(s, { holes: [{ cx: 2, cy: 1, age: 0 }] });
    expect(detectEvents(dug, s)).toEqual([]);
  });

  it("starts dust when a hole opens, and a refill when it closes or a crater fills", () => {
    const s = base();
    const dug = later(s, { holes: [{ cx: 2, cy: 1, age: 0 }] });
    expect(detectEvents(s, dug)).toEqual([{ kind: "dust", ...centre(2, 1) }]);
    expect(detectEvents(dug, later(dug, { holes: [] }))).toEqual([
      { kind: "refill", ...centre(2, 1) },
    ]);
    const blown = later(s, { craters: [{ cx: 4, cy: 1, left: 1 }] });
    expect(detectEvents(blown, later(blown, { craters: [] }))).toEqual([
      { kind: "refill", ...centre(4, 1) },
    ]);
  });

  it("sparkles where gold was taken, and lights the exit when the last gold goes", () => {
    const s = base();
    const taken = later(s, { tiles: ["...E..P.", "########"], goldLeft: 0 });
    expect(detectEvents(s, taken)).toEqual([
      { kind: "sparkle", ...centre(0, 0) },
      { kind: "exit", ...centre(3, 0) },
    ]);
  });

  it("starts a small or big blast once, and again when a new one goes off on the same cell", () => {
    const s = base();
    const boom = later(s, { blasts: [{ cx: 1, cy: 0, big: true, age: 0 }] });
    expect(detectEvents(s, boom)).toEqual([{ kind: "bigBlast", ...centre(1, 0) }]);
    const aged = later(boom, { blasts: [{ cx: 1, cy: 0, big: true, age: 1 }] });
    expect(detectEvents(boom, aged)).toEqual([]);
    const again = later(aged, { blasts: [{ cx: 1, cy: 0, big: false, age: 0 }] });
    expect(detectEvents(aged, again)).toEqual([{ kind: "blast", ...centre(1, 0) }]);
  });

  it("puffs when a gas cloud is fired", () => {
    const s = base();
    const fired = later(s, { clouds: [{ cx: 2, cy: 0, width: 3, left: 390 }] });
    expect(detectEvents(s, fired)).toEqual([{ kind: "gas", ...centre(2, 0) }]);
    const thinner = later(fired, { clouds: [{ cx: 2, cy: 0, width: 3, left: 389 }] });
    expect(detectEvents(fired, thinner)).toEqual([]);
  });

  it("flashes where an actor enters a teleporter and where it comes out", () => {
    const s = base();
    const gone = withPlayer(later(s), { warp: 45 });
    expect(detectEvents(s, gone)).toEqual([{ kind: "warpOut", ...centre(6, 0) }]);
    const out = withPlayer(later(gone), { warp: 0, x: 1 * SUB, y: 0 });
    expect(detectEvents(gone, out)).toEqual([{ kind: "warpIn", ...centre(1, 0) }]);
  });

  it("marks a player's death and a monk's", () => {
    const s = base();
    expect(detectEvents(s, withPlayer(later(s), { mode: "dead" }))).toEqual([
      { kind: "death", ...centre(6, 0) },
    ]);
    const withMonk = { ...s, monks: [newMonk(2, 0)] };
    const dead = later(withMonk, { monks: [{ ...newMonk(2, 0), mode: "dead" as const }] });
    expect(detectEvents(withMonk, dead)).toEqual([{ kind: "death", ...centre(2, 0) }]);
  });

  it("flashes where a player or a monk comes back", () => {
    const s = base();
    const dead = withPlayer(later(s), { mode: "dead" });
    const back = withPlayer(later(dead), { mode: "alive", x: 1 * SUB, y: 0 });
    expect(detectEvents(dead, back)).toEqual([{ kind: "respawn", ...centre(1, 0) }]);
    const gone = { ...s, monks: [{ ...newMonk(2, 0), mode: "dead" as const }] };
    const up = later(gone, { monks: [newMonk(5, 0)] });
    expect(detectEvents(gone, up)).toEqual([{ kind: "respawn", ...centre(5, 0) }]);
  });
});

describe("updateEffects", () => {
  const ev: FxEvent = { kind: "dust", x: 12, y: 12 };

  it("starts each event's effect once: the next frame's diff starts nothing", () => {
    const s = base();
    const dug = later(s, { holes: [{ cx: 2, cy: 1, age: 0 }] });
    let fx = updateEffects([], detectEvents(s, dug), 0);
    expect(fx).toHaveLength(1);
    fx = updateEffects(fx, detectEvents(dug, later(dug)), 16);
    expect(fx).toHaveLength(1);
  });

  it("drops each effect at the end of its life, not before", () => {
    for (const kind of KINDS) {
      const fx = updateEffects([], [{ ...ev, kind }], 1000);
      const life = FX[kind].life;
      expect(updateEffects(fx, [], 1000 + life - 1)).toHaveLength(1);
      expect(updateEffects(fx, [], 1000 + life)).toHaveLength(0);
    }
  });

  it("never runs more than MAX_EFFECTS, keeping the newest (1,000 random bursts)", () => {
    let rng = 7;
    const draw = (n: number): number => {
      const r = prngInt(rng, n);
      rng = r.state;
      return r.value;
    };
    let fx: Effect[] = [];
    let now = 0;
    for (let burst = 0; burst < 1000; burst++) {
      now += draw(200);
      const events = Array.from({ length: draw(80) }, () => ({
        kind: KINDS[draw(KINDS.length)] ?? "dust",
        x: draw(600),
        y: draw(400),
      }));
      fx = updateEffects(fx, events, now);
      expect(fx.length).toBeLessThanOrEqual(MAX_EFFECTS);
      if (events.length > 0) expect(fx.at(-1)?.born).toBe(now);
    }
  });

  it("gives the same effect the same particles, whatever else runs", () => {
    const a = updateEffects([], [ev], 50);
    const b = updateEffects(updateEffects([], [{ ...ev, kind: "gas" }], 10), [ev], 50);
    expect(b.at(-1)?.seed).toBe(a[0]?.seed);
  });
});

describe("reduced motion", () => {
  const boom = updateEffects([], [{ kind: "bigBlast", x: 100, y: 100 }], 0);

  it("shakes the scene for a blast, at most MAX_SHAKE, and stops when it ends", () => {
    const shakes = Array.from({ length: 20 }, (_, i) => shakeAt(boom, i * 33, false));
    expect(shakes.some((s) => s.x !== 0 || s.y !== 0)).toBe(true);
    for (const s of shakes) {
      expect(Math.abs(s.x)).toBeLessThanOrEqual(MAX_SHAKE);
      expect(Math.abs(s.y)).toBeLessThanOrEqual(MAX_SHAKE);
    }
    expect(shakeAt(boom, FX.bigBlast.life, false)).toEqual({ x: 0, y: 0 });
    const dust = updateEffects([], [{ kind: "dust", x: 1, y: 1 }], 0);
    expect(shakeAt(dust, 10, false)).toEqual({ x: 0, y: 0 });
  });

  it("turns off the shake", () => {
    for (let t = 0; t < FX.bigBlast.life; t += 17) {
      expect(shakeAt(boom, t, true)).toEqual({ x: 0, y: 0 });
    }
  });

  it("turns off the flashes and draws a quarter of the particles", () => {
    for (const kind of KINDS) {
      const fx = updateEffects([], [{ kind, x: 50, y: 50 }], 0);
      const full = recorder();
      drawEffects(full.ctx, fx, 10, false);
      const calm = recorder();
      drawEffects(calm.ctx, fx, 10, true);
      expect(full.flashes()).toBe(FX[kind].flash > 0 ? 1 : 0);
      expect(calm.flashes()).toBe(0);
      expect(full.fills()).toBe(FX[kind].particles);
      expect(calm.fills()).toBe(Math.ceil(FX[kind].particles / 4));
      expect(particleCount(kind, true)).toBeLessThan(particleCount(kind, false));
    }
  });

  it("draws nothing for an effect that has ended", () => {
    const r = recorder();
    drawEffects(r.ctx, boom, FX.bigBlast.life, false);
    expect(r.fills() + r.flashes()).toBe(0);
  });
});
