import { describe, expect, it } from "vitest";
import { gridCanvasSize, renderGrid, TILE_PX } from "../../src/render/canvas";

/** Records the colour of every filled rectangle, keyed by its top-left pixel. */
function recorder(): { ctx: CanvasRenderingContext2D; fills: Map<string, string[]> } {
  const fills = new Map<string, string[]>();
  let fillStyle = "";
  const ctx = {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v: string) {
      fillStyle = v;
    },
    strokeStyle: "",
    lineWidth: 1,
    fillRect(x: number, y: number) {
      const key = `${String(x)},${String(y)}`;
      fills.set(key, [...(fills.get(key) ?? []), fillStyle]);
    },
    strokeRect() {},
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills };
}

describe("gridCanvasSize", () => {
  it("is the grid size times TILE_PX, and 0 × 0 for an empty grid", () => {
    expect(gridCanvasSize(["...", "..."])).toEqual({ width: 3 * TILE_PX, height: 2 * TILE_PX });
    expect(gridCanvasSize([])).toEqual({ width: 0, height: 0 });
  });
});

describe("renderGrid", () => {
  it("fills the background, then draws start markers as actors, not as tiles", () => {
    const { ctx, fills } = recorder();
    renderGrid(ctx, ["P.M", "@@@"]);
    expect(fills.get("0,0")?.[0]).toBe("#111"); // background first
    // Runner head at (8, 2) of cell 0, monk head at (8, 2) of cell 2.
    expect(fills.get("8,2")).toEqual(["#f5f5f5"]);
    expect(fills.get(`${String(2 * TILE_PX + 8)},2`)).toEqual(["#e07b39"]);
    // Bedrock fills its whole cell.
    expect(fills.get(`0,${String(TILE_PX)}`)).toContain("#555");
  });

  it("does not throw on an empty grid", () => {
    expect(() => {
      renderGrid(recorder().ctx, []);
    }).not.toThrow();
  });
});
