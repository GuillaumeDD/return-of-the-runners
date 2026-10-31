import { describe, expect, it } from "vitest";
import { WORLDS, type World } from "../../src/level/format";
import { DIM, paintBackdrop } from "../../src/render/art/backdrops";
import { drawSlab } from "../../src/render/art/tiles";
import { WORLD_ART } from "../../src/render/art/worlds";
import { backdrops, MAX_BACKDROPS } from "../../src/render/backdrop";
import { fillBackdrop } from "../../src/render/canvas";
import type { SpriteSheet, Surface } from "../../src/render/sprites";
import { SIDE } from "../../src/render/terrain";

/** A fake 2D context that logs every call and every style or gradient stop it gets. */
function recorder(): { ctx: CanvasRenderingContext2D; log: string[] } {
  const log: string[] = [];
  const gradient = { addColorStop: (_: number, c: string) => log.push(`stop ${c}`) };
  const target: Record<string, unknown> = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  const ctx = new Proxy(target, {
    get: (t, p: string) =>
      p in t
        ? t[p]
        : (...args: unknown[]) => {
            log.push(
              `${p}(${args.map((a) => (typeof a === "number" ? a.toFixed(2) : "·")).join(",")})`,
            );
          },
    set(t, p: string, v: unknown) {
      if (typeof v === "string" || typeof v === "number") log.push(`${p}=${String(v)}`);
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
}

/** A surface that counts what it makes; `fail` makes none. */
function surfaces(fail = false): { surface: Surface; made: string[] } {
  const made: string[] = [];
  const surface: Surface = (w, h) => {
    made.push(`${String(w)}x${String(h)}`);
    if (fail) return null;
    return { image: { w, h } as unknown as CanvasImageSource, ctx: recorder().ctx };
  };
  return { surface, made };
}

describe("paintBackdrop", () => {
  it("starts with the world's day or night gradient, in every world", () => {
    for (const w of WORLDS) {
      for (const night of [false, true]) {
        const { ctx, log } = recorder();
        paintBackdrop(ctx, 672, 384, w, night);
        const [top, bottom] = WORLD_ART[w][night ? "night" : "day"];
        expect(log.slice(0, 2), `${w} ${String(night)}`).toEqual([`stop ${top}`, `stop ${bottom}`]);
      }
    }
  });

  it("paints a scene of its own in each world, the same at every call", () => {
    const scenes = new Set<string>();
    for (const w of WORLDS) {
      const a = recorder();
      const b = recorder();
      paintBackdrop(a.ctx, 672, 384, w, false);
      paintBackdrop(b.ctx, 672, 384, w, false);
      expect(a.log, w).toEqual(b.log);
      scenes.add(a.log.join("\n"));
    }
    expect(scenes.size).toBe(WORLDS.length);
  });

  it("is dimmed, more by night, and its lights use the world's glow colour", () => {
    expect(DIM.night).toBeGreaterThan(DIM.day);
    for (const w of WORLDS) {
      for (const night of [false, true]) {
        const { ctx, log } = recorder();
        paintBackdrop(ctx, 672, 384, w, night);
        expect(log, w).toContain(`fillStyle=rgba(0,0,0,${String(night ? DIM.night : DIM.day)})`);
        const glow = WORLD_ART[w].glow;
        const rgb = [1, 3, 5].map((i) => parseInt(glow.slice(i, i + 2), 16)).join(",");
        // The lights come after the dimming, so the dimming never hides them.
        const dim = log.lastIndexOf(`fillStyle=rgba(0,0,0,${String(night ? DIM.night : DIM.day)})`);
        expect(
          log.slice(dim).some((l) => l.includes(`rgba(${rgb},`)),
          w,
        ).toBe(true);
      }
    }
  });

  it("adds stars by night under an open sky only", () => {
    const stars = (w: World, night: boolean): boolean => {
      const { ctx, log } = recorder();
      paintBackdrop(ctx, 672, 384, w, night);
      return log.some((l) => l === "stop rgba(255,255,255,0.8)");
    };
    for (const w of ["moss", "ancient", "ice", "fossil"] as const) {
      expect(stars(w, true), w).toBe(true);
      expect(stars(w, false), w).toBe(false);
    }
    for (const w of ["lava", "dark", "industrial"] as const) expect(stars(w, true), w).toBe(false);
  });
});

describe("backdrops (cache)", () => {
  it("paints a scene once per world, night and size, at the sheet's scale", () => {
    const { surface, made } = surfaces();
    const get = backdrops(2, surface);
    const a = get("ice", false, 100, 50);
    expect(get("ice", false, 100, 50)).toBe(a);
    expect(made).toEqual(["200x100"]);
    expect(get("ice", true, 100, 50)).not.toBe(a);
    get("lava", false, 100, 50);
    get("ice", false, 101, 50);
    expect(made).toHaveLength(4);
  });

  it(`keeps at most ${String(MAX_BACKDROPS)}, dropping the least recently used`, () => {
    const { surface, made } = surfaces();
    const get = backdrops(1, surface);
    for (let i = 0; i < MAX_BACKDROPS; i++) get("moss", false, 10 + i, 10);
    get("moss", false, 10, 10); // used again: now the most recent
    get("moss", false, 99, 10); // drops 11 × 10, the oldest
    expect(made).toHaveLength(MAX_BACKDROPS + 1);
    get("moss", false, 10, 10);
    expect(made).toHaveLength(MAX_BACKDROPS + 1);
    get("moss", false, 11, 10);
    expect(made).toHaveLength(MAX_BACKDROPS + 2);
  });

  it("gives null when no surface can be made, without retrying every frame", () => {
    const { surface, made } = surfaces(true);
    const get = backdrops(1, surface);
    expect(get("moss", false, 10, 10)).toBeNull();
    expect(get("moss", false, 10, 10)).toBeNull();
    expect(made).toHaveLength(1);
    const throwing = backdrops(1, () => {
      throw new Error("no canvas");
    });
    expect(throwing("moss", false, 10, 10)).toBeNull();
  });
});

describe("fillBackdrop with painted backdrops", () => {
  const image = {} as CanvasImageSource;
  const sheet = (painted: CanvasImageSource | null): SpriteSheet => ({
    scale: 1,
    image: {} as CanvasImageSource,
    frames: new Map(),
    backdrops: () => painted,
  });

  it("draws the painted scene over the whole area", () => {
    const { ctx, log } = recorder();
    fillBackdrop(ctx, 120, 80, sheet(image), { world: "crystal", night: true });
    expect(log).toEqual(["drawImage(·,0.00,0.00,120.00,80.00)"]);
  });

  it("falls back to the gradient when none could be painted", () => {
    const { ctx, log } = recorder();
    fillBackdrop(ctx, 120, 80, sheet(null), { world: "crystal", night: true });
    expect(log).toContain(`stop ${WORLD_ART.crystal.night[0]}`);
    expect(log.some((l) => l.startsWith("drawImage"))).toBe(false);
  });
});

describe("world details on the slabs", () => {
  const ALL = 0; // no neighbour continues the slab: every edge open
  const CLOSED_BELOW = SIDE.down;

  const draw = (w: World, slab: "soft" | "hard", mask: number, variant = 0): string[] => {
    const { ctx, log } = recorder();
    drawSlab(ctx, slab, mask, variant, WORLD_ART[w]);
    return log;
  };

  it("gives every world's diggable slab a look of its own", () => {
    const looks = new Set(WORLDS.map((w) => draw(w, "soft", ALL, 1).join("\n")));
    expect(looks.size).toBe(WORLDS.length);
  });

  it("hangs icicles only under an open bottom edge", () => {
    const count = (mask: number): number =>
      draw("ice", "soft", mask).filter((l) => l === "fill()").length;
    expect(count(ALL)).toBeGreaterThan(count(CLOSED_BELOW));
  });

  it("draws lava cracks in the world's glow colour", () => {
    expect(draw("lava", "soft", ALL)).toContain(`strokeStyle=${WORLD_ART.lava.glow}`);
  });

  it("rivets bedrock in the industrial world only", () => {
    const rivets = (w: World): number =>
      draw(w, "hard", ALL).filter((l) => l.endsWith(",1.60,0.00,6.28)")).length;
    expect(rivets("industrial")).toBeGreaterThanOrEqual(4);
    for (const w of WORLDS) if (w !== "industrial") expect(rivets(w), w).toBe(0);
  });
});
