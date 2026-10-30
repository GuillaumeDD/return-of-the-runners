import { describe, expect, it } from "vitest";
import { TILE_PX } from "../../src/render/canvas";
import { backingStore, MAX_SCALE } from "../../src/render/scale";

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
