import { describe, expect, it } from "vitest";
import { gridCanvasSize, render, renderGrid, TILE_PX } from "../../src/render/canvas";
import { stateFrom, withPlayer } from "../sim/helpers";

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

/** The fills whose top-left pixel lies in cell (cx, cy). */
function fillsIn(fills: Map<string, string[]>, cx: number, cy: number): string[] {
  return [...fills.entries()]
    .filter(([k]) => {
      const [x = -1, y = -1] = k.split(",").map(Number);
      return Math.floor(x / TILE_PX) === cx && Math.floor(y / TILE_PX) === cy;
    })
    .flatMap(([, colors]) => colors);
}

describe("terrain the game hides", () => {
  const rows = ["P%hR", "####"];

  it("in the game: trapdoor turf looks like brick; hidden ladder and respawn point show nothing", () => {
    const { ctx, fills } = recorder();
    render(ctx, stateFrom(rows.map((r) => r + "$")));
    expect(fillsIn(fills, 1, 0)).toEqual(fillsIn(fills, 1, 1)); // brick below it
    expect(fillsIn(fills, 2, 0)).toEqual([]);
    expect(fillsIn(fills, 3, 0)).toEqual([]);
  });

  it("in the editor: each of them is drawn, and trapdoor turf has a mark brick has not", () => {
    const { ctx, fills } = recorder();
    renderGrid(ctx, rows);
    expect(fillsIn(fills, 1, 0).length).toBeGreaterThan(fillsIn(fills, 1, 1).length);
    expect(fillsIn(fills, 2, 0).length).toBeGreaterThan(0);
    expect(fillsIn(fills, 3, 0).length).toBeGreaterThan(0);
  });
});

describe("teleporters", () => {
  const SPARKLE = "#fff6c8";
  const LINK = "#7fd8f0";

  it("a player in transit is not drawn; a sparkle shows at the exit instead", () => {
    const rows = ["P..t", "@@@@"];
    const still = recorder();
    render(still.ctx, stateFrom(rows));
    expect(fillsIn(still.fills, 0, 0)).not.toContain(SPARKLE);
    const moving = recorder();
    render(moving.ctx, withPlayer(stateFrom(rows), { x: 3 * 8, warp: 10 }));
    expect(fillsIn(moving.fills, 3, 0)).toContain(SPARKLE);
    // No runner drawn anywhere: its head colour is absent.
    expect([...moving.fills.values()].flat()).not.toContain("#f5f5f5");
  });

  it("in the editor: links are drawn from entrance to exit, and the picked entrance is framed", () => {
    const rows = ["T...t", "@@@@@"];
    const none = recorder();
    renderGrid(none.ctx, rows);
    expect(fillsIn(none.fills, 2, 0)).not.toContain(LINK);
    const linked = recorder();
    renderGrid(linked.ctx, rows, [[0, 0, 4, 0]]);
    // The dotted line crosses the empty cells between them.
    expect(fillsIn(linked.fills, 2, 0)).toContain(LINK);
    expect(fillsIn(linked.fills, 0, 0)).not.toContain(SPARKLE);
    const picked = recorder();
    renderGrid(picked.ctx, rows, [[0, 0, 4, 0]], { cx: 0, cy: 0 });
    expect(fillsIn(picked.fills, 0, 0)).toContain(SPARKLE);
  });
});

describe("keys, doors and the exit", () => {
  const RED = "#e5484d";
  const GREEN = "#46a758";
  const OPEN = "#4caf50";

  it("in the game: no exit while gold is left; it shows once the gold is gone", () => {
    const rows = ["P.$E", "@@@@"];
    const before = recorder();
    render(before.ctx, stateFrom(rows));
    expect(fillsIn(before.fills, 3, 0)).toEqual([]);
    const after = recorder();
    render(after.ctx, { ...stateFrom(rows), goldLeft: 0 });
    expect(fillsIn(after.fills, 3, 0)).toContain(OPEN);
  });

  it("in the editor: the exit shows as an outline", () => {
    const { ctx } = recorder();
    let stroked = 0;
    (ctx as unknown as { strokeRect: () => void }).strokeRect = () => {
      stroked++;
    };
    renderGrid(ctx, ["P..E", "@@@@"]);
    expect(stroked).toBe(1);
  });

  it("a key and a door are drawn in their colour, in the game and the editor", () => {
    const rows = ["Pa.B", "@@@@"];
    for (const draw of [
      (c: CanvasRenderingContext2D) => {
        render(c, stateFrom(rows));
      },
      (c: CanvasRenderingContext2D) => {
        renderGrid(c, rows);
      },
    ]) {
      const { ctx, fills } = recorder();
      draw(ctx);
      expect(fillsIn(fills, 1, 0)).toContain(RED);
      expect(fillsIn(fills, 3, 0)).toContain(GREEN);
    }
  });

  it("the key a player holds is drawn in its hand", () => {
    const rows = ["P...", "@@@@"];
    const empty = recorder();
    render(empty.ctx, stateFrom(rows));
    expect([...empty.fills.values()].flat()).not.toContain(GREEN);
    const holding = recorder();
    render(holding.ctx, withPlayer(stateFrom(rows), { item: "b" }));
    expect(fillsIn(holding.fills, 0, 0)).toContain(GREEN);
  });
});
