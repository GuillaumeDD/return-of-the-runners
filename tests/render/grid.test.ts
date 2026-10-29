import { describe, expect, it } from "vitest";
import { gridCanvasSize, render, renderGrid, TILE_PX } from "../../src/render/canvas";
import { HOLE_TICKS } from "../../src/sim/rules";
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

describe("tools and rubble", () => {
  const STEEL = "#b8c0cc";
  const HANDLE = "#8b5a2b";
  const RUBBLE = "#8a7866";
  const BRICK = "#a0522d";
  const BEDROCK = "#555";

  it("a jackhammer and a pickaxe are drawn, in the game and the editor", () => {
    const rows = ["Pj.k", "@@@@"];
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
      expect(fillsIn(fills, 1, 0)).toContain(STEEL);
      expect(fillsIn(fills, 3, 0)).toContain(HANDLE);
    }
  });

  it("the tool a player holds is drawn in its hand", () => {
    const rows = ["P...", "@@@@"];
    for (const item of ["j", "k"]) {
      const { ctx, fills } = recorder();
      render(ctx, withPlayer(stateFrom(rows), { item }));
      expect(fillsIn(fills, 0, 0), item).toContain(STEEL);
    }
  });

  it("rubble is drawn where it is, falling rubble between two cells", () => {
    const s = stateFrom(["P...", "....", "@@@@"]);
    const { ctx, fills } = recorder();
    render(ctx, { ...s, rubble: [{ cx: 2, y: 4, landed: -1 }] });
    // Half a cell down (4 of 8 sub-units): its outline starts 1 px inside, at y = 12 + 1.
    expect(fills.get(`${String(2 * TILE_PX + 1)},${String(TILE_PX / 2 + 1)}`)).toBeDefined();
    expect(fillsIn(fills, 2, 0)).toContain(RUBBLE);
  });

  it("a hole drilled in bedrock is drawn as bedrock, a dug brick as brick", () => {
    const s = stateFrom(["P...", "@#..", "@@@@"]);
    // Closing holes: part of the cell shows again.
    const age = HOLE_TICKS.digging + HOLE_TICKS.open + 20;
    const { ctx, fills } = recorder();
    render(ctx, {
      ...s,
      holes: [
        { cx: 0, cy: 1, age },
        { cx: 1, cy: 1, age },
      ],
    });
    expect(fillsIn(fills, 0, 1)).toEqual([BEDROCK]);
    expect(fillsIn(fills, 1, 1)).toEqual([BRICK]);
  });
});

describe("bombs, blasts and craters", () => {
  const BOMB = "#2b2b33";
  const RING = "#c9a227";
  const SPARK = "#ffd84a";
  const BLAST = "#ff7a2f";
  const BLAST_BIG = "#ffe38a";
  const BRICK = "#a0522d";

  it("a small and a big bomb are drawn, in the game and the editor; only the big one has a ring", () => {
    const rows = ["Po.O", "@@@@"];
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
      expect(fillsIn(fills, 1, 0)).toContain(BOMB);
      expect(fillsIn(fills, 1, 0)).not.toContain(RING);
      expect(fillsIn(fills, 3, 0)).toContain(RING);
    }
  });

  it("a lit bomb is drawn with a spark", () => {
    const s = stateFrom(["P...", "@@@@"]);
    const { ctx, fills } = recorder();
    render(ctx, { ...s, fuses: [{ cx: 2, cy: 0, big: false, left: 30 }] });
    expect(fillsIn(fills, 2, 0)).toContain(BOMB);
    expect(fillsIn(fills, 2, 0)).toContain(SPARK);
  });

  it("a blast lights up every cell it covers, in its size's colour", () => {
    const s = stateFrom(["P.......", "........", "@@@@@@@@"]);
    const small = recorder();
    render(small.ctx, { ...s, blasts: [{ cx: 3, cy: 0, big: false, age: 0 }] });
    for (const x of [1, 2, 3, 4, 5]) expect(fillsIn(small.fills, x, 0)).toContain(BLAST);
    expect(fillsIn(small.fills, 6, 0)).not.toContain(BLAST);
    const big = recorder();
    render(big.ctx, { ...s, blasts: [{ cx: 3, cy: 1, big: true, age: 5 }] });
    expect(fillsIn(big.fills, 3, 0)).toContain(BLAST_BIG);
  });

  it("an open crater shows no brick; the brick grows back at the end", () => {
    const s = stateFrom(["P...", "####", "@@@@"]);
    const open = recorder();
    render(open.ctx, { ...s, craters: [{ cx: 1, cy: 1, left: 500 }] });
    expect(fillsIn(open.fills, 1, 1)).toEqual([]);
    expect(fillsIn(open.fills, 2, 1)).toContain(BRICK);
    const closing = recorder();
    render(closing.ctx, { ...s, craters: [{ cx: 1, cy: 1, left: 10 }] });
    expect(fillsIn(closing.fills, 1, 1)).toEqual([BRICK]);
  });
});
