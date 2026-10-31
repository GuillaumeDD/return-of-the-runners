import { describe, expect, it } from "vitest";
import { TILE_PX } from "../../src/render/canvas";
import {
  backingStore,
  GAME_SIZES,
  gameWidth,
  MAX_SCALE,
  parseGameSize,
} from "../../src/render/scale";

const LEVEL = { width: 28 * TILE_PX, height: 16 * TILE_PX };

describe("backingStore", () => {
  it.each([
    [1, 24],
    [1.5, 36],
    [2, 48],
    [3, 72],
  ])(
    "at device pixel ratio %s, a tile shown at its logical size covers %s device pixels",
    (dpr, tile) => {
      const s = backingStore(LEVEL, LEVEL.width, dpr);
      expect(s.scale * TILE_PX).toBe(tile);
      expect(s).toEqual({ width: 28 * tile, height: 16 * tile, scale: tile / TILE_PX });
    },
  );

  it("follows the size the canvas is shown at (CSS scaling ×2 at ratio 2 is ×4)", () => {
    expect(backingStore(LEVEL, LEVEL.width * 2, 2).scale).toBe(4);
    expect(backingStore(LEVEL, LEVEL.width / 2, 2).scale).toBe(1);
  });

  it("never gives a fractional size, and a tile is always whole device pixels", () => {
    for (const dpr of [1, 1.1, 1.25, 1.333, 1.5, 1.75, 2, 2.625, 3]) {
      for (const css of [0, 333.3, 500, 671.9, 672, 1000.5, 1344]) {
        for (const cols of [8, 13, 28, 64]) {
          const s = backingStore({ width: cols * TILE_PX, height: 9 * TILE_PX }, css, dpr);
          expect(Number.isInteger(s.width)).toBe(true);
          expect(Number.isInteger(s.height)).toBe(true);
          expect(Number.isInteger(s.scale * TILE_PX)).toBe(true);
          expect(s.width).toBe(cols * Math.round(s.scale * TILE_PX));
        }
      }
    }
  });

  it("never makes the canvas wider than the space it is shown in", () => {
    for (const dpr of [1, 1.25, 1.5, 2, 3]) {
      for (const css of [320.5, 466.6, 968, 1344]) {
        expect(backingStore(LEVEL, css, dpr).width).toBeLessThanOrEqual(css * dpr);
      }
    }
  });

  it("caps the scale at MAX_SCALE and keeps at least one device pixel a tile", () => {
    expect(backingStore(LEVEL, LEVEL.width * 10, 3).scale).toBe(MAX_SCALE);
    expect(backingStore(LEVEL, 1, 1).scale).toBe(1 / TILE_PX);
  });

  it("treats a canvas not laid out yet as shown at its logical size", () => {
    expect(backingStore(LEVEL, 0, 2)).toEqual(backingStore(LEVEL, LEVEL.width, 2));
  });

  it("falls back to ratio 1 on a missing or invalid device pixel ratio", () => {
    for (const dpr of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(backingStore(LEVEL, LEVEL.width, dpr).scale).toBe(1);
    }
  });

  it("is 0 × 0 for an empty grid", () => {
    expect(backingStore({ width: 0, height: 0 }, 100, 2)).toEqual({
      width: 0,
      height: 0,
      scale: 1,
    });
  });
});

describe("game size (B-048)", () => {
  const frame = { width: 696, height: 436 };
  const wide = { width: 2000, height: 5000 };

  it("a percentage is that share of the logical size", () => {
    expect(gameWidth(50, frame, wide)).toBe(348);
    expect(gameWidth(100, frame, wide)).toBe(696);
    expect(gameWidth(200, frame, wide)).toBe(1392);
  });

  it("is never wider than the room, whatever the size", () => {
    for (const size of GAME_SIZES) {
      expect(gameWidth(size, frame, { width: 500, height: 5000 })).toBeLessThanOrEqual(500);
    }
  });

  it('"fit" fills the room\'s height, keeping the aspect', () => {
    const w = gameWidth("fit", frame, { width: 3000, height: 655 });
    expect(w).toBeCloseTo(1044);
    expect((w * frame.height) / frame.width).toBeCloseTo(654); // 1 px spare
  });

  it('"fit" takes the width when the room is narrow', () => {
    expect(gameWidth("fit", frame, { width: 400, height: 2000 })).toBe(400);
  });

  it('"fit" stops shrinking at a quarter of the logical size', () => {
    expect(gameWidth("fit", frame, { width: 2000, height: -50 })).toBe(174);
    expect(gameWidth("fit", frame, { width: 2000, height: 10 })).toBe(174);
  });

  it("a fitted canvas, once rounded to whole device pixels, still fits the room", () => {
    for (const dpr of [1, 1.25, 1.5, 2, 3]) {
      for (const height of [300, 487.5, 654, 811, 1000]) {
        const css = gameWidth("fit", frame, { width: 3000, height });
        const store = backingStore(frame, css, dpr);
        expect(store.height / dpr).toBeLessThanOrEqual(height);
      }
    }
  });

  it("an empty logical size gives no width", () => {
    expect(gameWidth("fit", { width: 0, height: 10 }, wide)).toBe(0);
  });

  it("reads a stored size back, and anything unknown as fit", () => {
    expect(parseGameSize("75")).toBe(75);
    expect(parseGameSize("fit")).toBe("fit");
    for (const bad of [null, "", "80", "1e2", " 75", "Fit", "__proto__"]) {
      expect(parseGameSize(bad)).toBe("fit");
    }
  });
});
