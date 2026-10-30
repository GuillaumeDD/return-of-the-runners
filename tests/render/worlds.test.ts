import { describe, expect, it } from "vitest";
import { WORLDS } from "../../src/level/format";
import { drawSlab } from "../../src/render/art/tiles";
import { WORLD_ART } from "../../src/render/art/worlds";
import { DEFAULT_SCENE, fillBackdrop } from "../../src/render/canvas";
import { SPRITES, spritesFor } from "../../src/render/sheet";
import type { SpriteSheet } from "../../src/render/sprites";

const HEX = /^#[0-9a-f]{6}$/;

/** Records the colours a drawing uses: fill styles, and gradient stops. */
function recorder(): { ctx: CanvasRenderingContext2D; colors: string[] } {
  const colors: string[] = [];
  const gradient = { addColorStop: (_: number, c: string) => colors.push(c) };
  const target: Record<string, unknown> = {
    set fillStyle(v: unknown) {
      if (typeof v === "string") colors.push(v);
    },
    get fillStyle() {
      return "";
    },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  const ctx = new Proxy(target, {
    get: (t, p: string) => (p in t ? t[p] : () => undefined),
    set(t, p: string, v: unknown) {
      t[p] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, colors };
}

/** Relative luminance of a #rrggbb colour (0 to 1), close enough to compare shades. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

describe("worlds", () => {
  it("every world has every sprite of the default one: no fallback left", () => {
    const keys = SPRITES.map((s) => s.key);
    for (const w of WORLDS) expect(spritesFor(w).map((s) => s.key)).toEqual(keys);
  });

  it("every world's colours are #rrggbb, and each world has its own terrain colour", () => {
    for (const w of WORLDS) {
      const art = WORLD_ART[w];
      for (const c of [
        ...art.soft,
        ...art.hard,
        ...art.top,
        ...art.hardTop,
        ...art.day,
        ...art.night,
      ]) {
        expect(c, w).toMatch(HEX);
      }
    }
    expect(new Set(WORLDS.map((w) => WORLD_ART[w].soft[2])).size).toBe(WORLDS.length);
  });

  it("draws a slab in its world's colours", () => {
    for (const w of WORLDS) {
      const { ctx, colors } = recorder();
      drawSlab(ctx, "soft", 0, 0, WORLD_ART[w]);
      expect(colors, w).toContain(WORLD_ART[w].soft[1]);
      expect(colors, w).toContain(WORLD_ART[w].top[0]);
      for (const other of WORLDS) {
        if (WORLD_ART[other].soft[1] !== WORLD_ART[w].soft[1]) {
          expect(colors, `${w} uses ${other}`).not.toContain(WORLD_ART[other].soft[1]);
        }
      }
    }
  });

  it("lists shades darkest to lightest", () => {
    for (const w of WORLDS) {
      for (const shades of [WORLD_ART[w].soft, WORLD_ART[w].hard]) {
        const l = shades.map(luminance);
        for (let i = 1; i < l.length; i++) expect(l[i], w).toBeGreaterThan(l[i - 1] ?? 0);
      }
    }
  });
});

describe("backdrop", () => {
  const ART: SpriteSheet = { scale: 1, image: {} as CanvasImageSource, frames: new Map() };
  const NONE: SpriteSheet = { scale: 1, image: null, frames: new Map() };

  it("is the world's gradient with art, by day or by night", () => {
    for (const w of WORLDS) {
      for (const night of [false, true]) {
        const { ctx, colors } = recorder();
        fillBackdrop(ctx, 100, 100, ART, { world: w, night });
        expect(colors).toEqual([...WORLD_ART[w][night ? "night" : "day"]]);
      }
    }
  });

  it("is darker by night than by day, in every world", () => {
    for (const w of WORLDS) {
      const day = WORLD_ART[w].day.map(luminance);
      const night = WORLD_ART[w].night.map(luminance);
      expect(night[0], w).toBeLessThan(day[0] ?? 0);
      expect(night[1], w).toBeLessThanOrEqual(day[1] ?? 0);
    }
  });

  it("stays the placeholder background without art", () => {
    const { ctx, colors } = recorder();
    fillBackdrop(ctx, 100, 100, NONE, DEFAULT_SCENE);
    expect(colors).toEqual(["#111"]);
  });
});
