import { describe, expect, it } from "vitest";
import { TILE, TILE_CHARS } from "../../src/level/format";
import { SPRITES } from "../../src/render/sheet";
import {
  buildSheet,
  drawSprite,
  frameAt,
  frameKey,
  MAX_ROW,
  type SpriteDef,
  type Surface,
  TILE_ART,
  tileArt,
} from "../../src/render/sprites";

/** A fake 2D context that records what is drawn; enough for the sheet builder. */
function fakeCtx(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = [];
  const ctx = {
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    setTransform: (a: number, _b: number, _c: number, _d: number, e: number, f: number) =>
      calls.push(`transform ${String(a)} ${String(e)} ${String(f)}`),
    clearRect: (x: number) => calls.push(`clear ${String(x)}`),
    beginPath: () => {},
    rect: (_x: number, _y: number, w: number, h: number) =>
      calls.push(`clip ${String(w)}x${String(h)}`),
    clip: () => {},
    fillRect: () => calls.push("fill"),
    drawImage: (...args: unknown[]) => calls.push(`image ${args.slice(1).join(" ")}`),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const image = {} as CanvasImageSource;

function surface(): { make: Surface; sizes: [number, number][] } {
  const sizes: [number, number][] = [];
  return {
    sizes,
    make: (w, h) => {
      sizes.push([w, h]);
      return { image, ctx: fakeCtx().ctx };
    },
  };
}

const def = (
  key: string,
  width = 24,
  height = 24,
  draw: (ctx: CanvasRenderingContext2D) => void = () => {},
): SpriteDef => ({
  key,
  width,
  height,
  draw,
});

describe("TILE_ART", () => {
  it("lists every tile of the format, each with a sprite or a placeholder (null)", () => {
    expect(new Set(Object.keys(TILE_ART))).toEqual(TILE_CHARS);
    for (const tile of TILE_CHARS) {
      const art = tileArt(tile);
      expect(art === null || SPRITES.some((s) => s.key === art)).toBe(true);
    }
  });

  it("gives no art to a character outside the format, nor to inherited keys", () => {
    expect(tileArt("?")).toBeNull();
    expect(tileArt("toString")).toBeNull();
    expect(tileArt(TILE.brick)).toBe(TILE_ART[TILE.brick]);
  });
});

describe("buildSheet", () => {
  it("packs the sprites on one row at the given scale, one pixel apart", () => {
    const s = surface();
    const sheet = buildSheet([def("a"), def("b", 12, 30)], 1.5, s.make);
    expect(s.sizes).toEqual([[36 + 1 + 18 + 1, 45]]);
    expect(sheet.frames.get("a")).toEqual({ sx: 0, sy: 0, sw: 36, sh: 36, width: 24, height: 24 });
    expect(sheet.frames.get("b")).toEqual({ sx: 37, sy: 0, sw: 18, sh: 45, width: 12, height: 30 });
  });

  it("draws each sprite at its place, scaled", () => {
    const { ctx, calls } = fakeCtx();
    buildSheet(
      [
        def("a", 24, 24, (c) => {
          c.fillRect(0, 0, 1, 1);
        }),
        def("b"),
      ],
      2,
      () => ({
        image,
        ctx,
      }),
    );
    expect(calls).toEqual([
      "save",
      "transform 2 0 0",
      "clip 24x24",
      "fill",
      "restore",
      "save",
      "transform 2 49 0",
      "clip 24x24",
      "restore",
    ]);
  });

  it("starts a new row before a sprite would cross MAX_ROW device pixels", () => {
    const s = surface();
    const wide = MAX_ROW / 3; // three fit with no gap, only two with gaps
    const sheet = buildSheet(
      [def("a", wide, 10), def("b", wide, 20), def("c", wide, 10)],
      1,
      s.make,
    );
    expect(sheet.frames.get("a")).toMatchObject({ sx: 0, sy: 0 });
    expect(sheet.frames.get("b")).toMatchObject({ sx: Math.ceil(wide) + 1, sy: 0 });
    expect(sheet.frames.get("c")).toMatchObject({ sx: 0, sy: 21 });
    const [w = 0, h = 0] = s.sizes[0] ?? [];
    expect(w).toBeLessThanOrEqual(MAX_ROW + 1);
    expect(h).toBe(31);
  });

  it("clips each sprite to its box, so it cannot spill on a neighbour", () => {
    const { ctx, calls } = fakeCtx();
    buildSheet([def("a", 12, 18)], 1, () => ({ image, ctx }));
    expect(calls).toContain("clip 12x18");
  });

  it("leaves out a sprite whose drawing throws, and keeps the others", () => {
    const { ctx, calls } = fakeCtx();
    const broken = def("broken", 24, 24, () => {
      throw new Error("no art");
    });
    const sheet = buildSheet([broken, def("ok")], 1, () => ({ image, ctx }));
    expect(sheet.frames.has("broken")).toBe(false);
    expect(sheet.frames.has("ok")).toBe(true);
    expect(calls).toContain("clear 0");
  });

  it("falls back to an empty sheet, without throwing, when no surface can be made", () => {
    const none = buildSheet([def("a")], 1, () => null);
    expect(none.image).toBeNull();
    expect(none.frames.size).toBe(0);
    const throwing = buildSheet([def("a")], 1, () => {
      throw new Error("no canvas");
    });
    expect(throwing.frames.size).toBe(0);
  });

  it("makes no surface when there is nothing to draw", () => {
    const s = surface();
    expect(buildSheet([], 2, s.make).frames.size).toBe(0);
    expect(s.sizes).toEqual([]);
  });
});

describe("drawSprite", () => {
  it("copies the frame's device pixels into its logical size, and says so", () => {
    const sheet = buildSheet([def("x"), def("a", 12, 20)], 2, surface().make);
    const { ctx, calls } = fakeCtx();
    expect(drawSprite(ctx, sheet, "a", 5, 7)).toBe(true);
    expect(calls).toEqual(["image 49 0 24 40 5 7 12 20"]);
  });

  it("returns false, drawing nothing, for a missing key, no key or an empty sheet", () => {
    const sheet = buildSheet([def("a")], 1, surface().make);
    const empty = buildSheet([def("a")], 1, () => null);
    const { ctx, calls } = fakeCtx();
    expect(drawSprite(ctx, sheet, "missing", 0, 0)).toBe(false);
    expect(drawSprite(ctx, sheet, null, 0, 0)).toBe(false);
    expect(drawSprite(ctx, empty, "a", 0, 0)).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe("frameAt", () => {
  const run = { name: "run", frames: 8, fps: 12 };

  it("depends only on the animation and the time", () => {
    expect(frameAt(run, 250)).toBe(frameAt(run, 250));
    expect(frameAt(run, 0)).toBe(0);
    expect(frameAt(run, 1000 / 12)).toBe(1);
    expect(frameAt(run, 249)).toBe(2);
  });

  it("loops within the animation's length", () => {
    for (let t = 0; t < 10_000; t += 7) {
      const f = frameAt(run, t);
      expect(Number.isInteger(f)).toBe(true);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(run.frames);
    }
    expect(frameAt(run, (8 * 1000) / 12)).toBe(0);
  });

  it("shows the first frame of a still, and for an invalid time", () => {
    expect(frameAt({ name: "idle", frames: 1, fps: 12 }, 5000)).toBe(0);
    for (const t of [-1, Number.NaN, Number.POSITIVE_INFINITY]) expect(frameAt(run, t)).toBe(0);
  });

  it("names each frame's sprite", () => {
    expect(frameKey(run, 3)).toBe("run:3");
  });
});
