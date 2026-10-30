/**
 * Visual effects: particles, light flashes and screen shake, started by what changed in
 * the state between two rendered frames (a hole dug, gold taken, a blast…). Purely
 * visual: nothing here feeds back into the simulation, and an effect's look is a pure
 * function of its start and the render time, so drawing never mutates anything.
 * See docs/ARCHITECTURE.md § Art direction.
 */
import { TILE } from "../level/format";
import { prngNext } from "../sim/prng";
import { SUB } from "../sim/rules";
import type { Actor, GameState } from "../sim/state";
import { TILE_PX } from "./canvas";

export type FxKind =
  | "dust"
  | "refill"
  | "sparkle"
  | "exit"
  | "blast"
  | "bigBlast"
  | "gas"
  | "warpOut"
  | "warpIn"
  | "death"
  | "respawn";

/** Something that happened, centred on (x, y) in logical pixels. */
export interface FxEvent {
  readonly kind: FxKind;
  readonly x: number;
  readonly y: number;
}

/** A running effect: its event, its start (render time, ms) and its particle seed. */
export interface Effect extends FxEvent {
  readonly born: number;
  readonly seed: number;
}

interface Spec {
  /** Lifetime in ms. */
  readonly life: number;
  /** Particles at full motion (a quarter, rounded up, under reduced motion). */
  readonly particles: number;
  /** How far particles travel over the effect's life, in logical pixels. */
  readonly spread: number;
  /** Downward pull over the life, in logical pixels (negative rises). */
  readonly gravity: number;
  readonly colors: readonly string[];
  /** Radius of a light flash, or 0; never drawn under reduced motion. */
  readonly flash: number;
  /** Screen shake at the start, in logical pixels; none under reduced motion. */
  readonly shake: number;
}

const MOSS_CRUMBS = ["#a6d867", "#5f9a3a", "#3b2a1a"];

export const FX: Readonly<Record<FxKind, Spec>> = {
  dust: {
    life: 450,
    particles: 8,
    spread: 10,
    gravity: 10,
    colors: MOSS_CRUMBS,
    flash: 0,
    shake: 0,
  },
  refill: {
    life: 350,
    particles: 6,
    spread: 8,
    gravity: -4,
    colors: MOSS_CRUMBS,
    flash: 0,
    shake: 0,
  },
  sparkle: {
    life: 600,
    particles: 10,
    spread: 12,
    gravity: -10,
    colors: ["#fff6c8", "#ffd84a"],
    flash: 0,
    shake: 0,
  },
  exit: {
    life: 900,
    particles: 14,
    spread: 16,
    gravity: -14,
    colors: ["#fff6c8", "#c8f27a"],
    flash: 30,
    shake: 0,
  },
  blast: {
    life: 500,
    particles: 16,
    spread: 26,
    gravity: 8,
    colors: ["#ffe38a", "#ff7a2f", "#5a4a3a"],
    flash: 34,
    shake: 2,
  },
  bigBlast: {
    life: 700,
    particles: 28,
    spread: 44,
    gravity: 10,
    colors: ["#ffffff", "#ffe38a", "#ff7a2f", "#5a4a3a"],
    flash: 60,
    shake: 4,
  },
  gas: {
    life: 500,
    particles: 10,
    spread: 14,
    gravity: -6,
    colors: ["#b8f0a8", "#78d26e"],
    flash: 0,
    shake: 0,
  },
  warpOut: {
    life: 400,
    particles: 10,
    spread: 12,
    gravity: -8,
    colors: ["#bff6ff", "#4fd8f0"],
    flash: 22,
    shake: 0,
  },
  warpIn: {
    life: 400,
    particles: 10,
    spread: 12,
    gravity: -8,
    colors: ["#f0d8ff", "#b07ef0"],
    flash: 22,
    shake: 0,
  },
  death: {
    life: 700,
    particles: 14,
    spread: 16,
    gravity: 12,
    colors: ["#ffffff", "#ff8a7a"],
    flash: 26,
    shake: 0,
  },
  respawn: {
    life: 500,
    particles: 12,
    spread: 14,
    gravity: -12,
    colors: ["#ffffff", "#bff6ff"],
    flash: 24,
    shake: 0,
  },
};

/** Most effects running at once; the oldest make room for new ones. */
export const MAX_EFFECTS = 48;

/** The largest screen shake, in logical pixels, however many blasts overlap. */
export const MAX_SHAKE = 4;

const PX_PER_SUB = TILE_PX / SUB;

function cellCentre(cx: number, cy: number): { x: number; y: number } {
  return { x: (cx + 0.5) * TILE_PX, y: (cy + 0.5) * TILE_PX };
}

function actorCentre(a: { readonly x: number; readonly y: number }): { x: number; y: number } {
  return { x: a.x * PX_PER_SUB + TILE_PX / 2, y: a.y * PX_PER_SUB + TILE_PX / 2 };
}

const cellKey = (c: { readonly cx: number; readonly cy: number }): string =>
  `${String(c.cx)},${String(c.cy)}`;

/**
 * What happened between two states of the same game, as effect events. A state from
 * another game, or an earlier one (the level restarted), starts nothing.
 */
export function detectEvents(prev: GameState, next: GameState): FxEvent[] {
  if (
    next.tick <= prev.tick ||
    next.width !== prev.width ||
    next.height !== prev.height ||
    next.monks.length !== prev.monks.length ||
    next.players.length !== prev.players.length
  ) {
    return [];
  }
  const out: FxEvent[] = [];
  const at = (kind: FxKind, p: { x: number; y: number }): void => {
    out.push({ kind, x: p.x, y: p.y });
  };

  // Holes: dust when one opens, a puff when it fills; craters fill the same way.
  const before = new Set(prev.holes.map(cellKey));
  const after = new Set(next.holes.map(cellKey));
  for (const h of next.holes) if (!before.has(cellKey(h))) at("dust", cellCentre(h.cx, h.cy));
  for (const h of prev.holes) if (!after.has(cellKey(h))) at("refill", cellCentre(h.cx, h.cy));
  const craters = new Set(next.craters.map(cellKey));
  for (const c of prev.craters) {
    if (!craters.has(cellKey(c))) at("refill", cellCentre(c.cx, c.cy));
  }

  // Gold taken (by a runner or a monk) and the exit appearing.
  prev.tiles.forEach((row, cy) => {
    const now = next.tiles[cy] ?? "";
    for (let cx = 0; cx < row.length; cx++) {
      if (row.charAt(cx) === TILE.gold && now.charAt(cx) !== TILE.gold) {
        at("sparkle", cellCentre(cx, cy));
      }
    }
  });
  if (prev.goldLeft > 0 && next.goldLeft === 0) {
    next.tiles.forEach((row, cy) => {
      for (let cx = 0; cx < row.length; cx++) {
        if (row.charAt(cx) === TILE.exit) at("exit", cellCentre(cx, cy));
      }
    });
  }

  // Blasts and gas clouds: new ones, or one that started again on the same cell.
  const blasts = new Map(prev.blasts.map((b) => [cellKey(b), b.age]));
  for (const b of next.blasts) {
    const age = blasts.get(cellKey(b));
    if (age === undefined || b.age < age) {
      at(b.big ? "bigBlast" : "blast", cellCentre(b.cx, b.cy));
    }
  }
  const clouds = new Map(prev.clouds.map((c) => [cellKey(c), c.left]));
  for (const c of next.clouds) {
    const left = clouds.get(cellKey(c));
    if (left === undefined || c.left > left) at("gas", cellCentre(c.cx, c.cy));
  }

  // Teleports (a flash where an actor vanishes, another where it appears) and deaths.
  const actors = (s: GameState): readonly Actor[] => [...s.monks, ...s.players];
  const was = actors(prev);
  actors(next).forEach((a, i) => {
    const b = was[i];
    if (b === undefined) return;
    if (b.warp === 0 && a.warp > 0) at("warpOut", actorCentre(b));
    if (b.warp > 0 && a.warp === 0) at("warpIn", actorCentre(a));
  });
  // Deaths, and coming back: a player at its start, a monk near the top.
  next.players.forEach((p, i) => {
    const b = prev.players[i];
    if (b?.mode === "alive" && p.mode === "dead") at("death", actorCentre(p));
    if (b !== undefined && b.mode !== "alive" && p.mode === "alive") {
      at("respawn", actorCentre(p));
    }
  });
  next.monks.forEach((m, i) => {
    const b = prev.monks[i];
    if (b === undefined) return;
    if (b.mode !== "dead" && m.mode === "dead") at("death", actorCentre(b));
    if (b.mode === "dead" && m.mode !== "dead") at("respawn", actorCentre(m));
  });
  return out;
}

/** A seed for an effect's particles, from what it is, where and when. */
function seedOf(e: FxEvent, born: number, index: number): number {
  let s = prngNext((Math.round(e.x) * 73856093) ^ (Math.round(e.y) * 19349663)).value;
  s = prngNext(s ^ Math.round(born) ^ (index * 83492791)).value;
  return prngNext(s ^ Object.keys(FX).indexOf(e.kind)).value;
}

/**
 * The effects running at `now`: the expired ones dropped, `events` started, and the
 * oldest dropped past `MAX_EFFECTS`.
 */
export function updateEffects(
  effects: readonly Effect[],
  events: readonly FxEvent[],
  now: number,
): Effect[] {
  const alive = effects.filter((e) => now - e.born < FX[e.kind].life);
  const started = events.map((e, i) => ({ ...e, born: now, seed: seedOf(e, now, i) }));
  const all = [...alive, ...started];
  return all.length > MAX_EFFECTS ? all.slice(all.length - MAX_EFFECTS) : all;
}

/** Particles an effect draws: a quarter (rounded up) under reduced motion. */
export function particleCount(kind: FxKind, reduced: boolean): number {
  const n = FX[kind].particles;
  return reduced ? Math.ceil(n / 4) : n;
}

/** A value in [-1, 1) from a seed, and the next seed. */
function unit(seed: number): { v: number; seed: number } {
  const r = prngNext(seed);
  return { v: r.value / 0x80000000 - 1, seed: r.value };
}

/** How far through its life an effect is at `now`, from 0 to 1, or null when not running. */
function progress(e: Effect, now: number): number | null {
  const t = (now - e.born) / FX[e.kind].life;
  return t >= 0 && t < 1 ? t : null;
}

/** Draws every running effect over the scene. */
export function drawEffects(
  ctx: CanvasRenderingContext2D,
  effects: readonly Effect[],
  now: number,
  reduced: boolean,
): void {
  for (const e of effects) {
    const t = progress(e, now);
    if (t === null) continue;
    const spec = FX[e.kind];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (spec.flash > 0 && !reduced) {
      const r = spec.flash * (0.6 + 0.4 * t);
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
      g.addColorStop(0, spec.colors[0] ?? "#fff");
      g.addColorStop(0.35, spec.colors[1] ?? spec.colors[0] ?? "#fff");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.9 * (1 - t) * (1 - t);
      ctx.fillStyle = g;
      ctx.fillRect(e.x - r, e.y - r, 2 * r, 2 * r);
    }
    let seed = e.seed;
    const n = particleCount(e.kind, reduced);
    for (let i = 0; i < n; i++) {
      const dx = unit(seed);
      const dy = unit(dx.seed);
      const speed = unit(dy.seed);
      seed = speed.seed;
      // A burst that slows down (ease-out), each particle at its own speed.
      const reach = spec.spread * (0.7 + 0.3 * speed.v) * (1 - (1 - t) * (1 - t));
      const x = e.x + dx.v * reach;
      const y = e.y + dy.v * reach + spec.gravity * t * t;
      const size = 2 + (1 - t) * (2 + speed.v);
      ctx.globalAlpha = 1 - t * t;
      ctx.fillStyle = spec.colors[i % spec.colors.length] ?? "#fff";
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }
    ctx.restore();
  }
}

/**
 * How far the scene is shaken at `now`, in logical pixels: the blasts' shake, fading
 * over their life, at most `MAX_SHAKE`; none under reduced motion.
 */
export function shakeAt(
  effects: readonly Effect[],
  now: number,
  reduced: boolean,
): { x: number; y: number } {
  if (reduced) return { x: 0, y: 0 };
  let amp = 0;
  for (const e of effects) {
    const t = progress(e, now);
    if (t !== null) amp = Math.max(amp, FX[e.kind].shake * (1 - t));
  }
  if (amp === 0) return { x: 0, y: 0 };
  amp = Math.min(MAX_SHAKE, amp);
  // A new direction every 30 ms or so, the same for the same instant.
  const a = unit(Math.floor(now / 32) + 1);
  const b = unit(a.seed);
  return { x: Math.round(a.v * amp), y: Math.round(b.v * amp) };
}
