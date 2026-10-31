import { describe, expect, it } from "vitest";
import { TILE, TILE_CHARS, codePoints, type TileChar } from "../../src/level/format";
import {
  UNDO_LIMIT,
  beginStroke,
  endStroke,
  editorFrom,
  erase,
  lineCells,
  newEditor,
  paint,
  paintLine,
  redo,
  rename,
  sameContent,
  resize,
  selectTile,
  toDocument,
  toDraft,
  toLevel,
  undo,
  linkAt,
  relink,
  selectLinkTool,
  setNight,
  setWorld,
  type EditorState,
} from "../../src/editor/model";
import { makeRng, randInt } from "../helpers/rng";

const at = (s: EditorState, x: number, y: number): string => s.grid[y]?.charAt(x) ?? "";
const count = (s: EditorState, tile: string): number =>
  s.grid
    .join("")
    .split("")
    .filter((c) => c === tile).length;

describe("a new level", () => {
  it("is 28×16, empty, on a bedrock floor, with the name it is given", () => {
    const s = newEditor("  My level ");
    expect(s.grid).toHaveLength(16);
    expect(s.grid.every((row) => row.length === 28)).toBe(true);
    expect(s.grid.slice(0, -1).join("")).toMatch(/^\.+$/);
    expect(s.grid.at(-1)).toBe("@".repeat(28));
    expect(s.name).toBe("My level");
    expect(s.undo).toEqual([]);
    expect(s.redo).toEqual([]);
  });
});

describe("paint and erase", () => {
  it("paint sets one cell with the selected tile; erase empties it", () => {
    const s = paint(selectTile(newEditor("t"), TILE.ladder), 3, 4);
    expect(at(s, 3, 4)).toBe(TILE.ladder);
    expect(count(s, TILE.ladder)).toBe(1);
    expect(at(erase(s, 3, 4), 3, 4)).toBe(TILE.empty);
  });

  it("painting the same tile again is a no-op, with no undo entry", () => {
    const s = paint(newEditor("t"), 1, 1, TILE.gold);
    expect(paint(s, 1, 1, TILE.gold)).toBe(s);
    expect(s.undo).toHaveLength(1);
  });

  it("outside the grid changes nothing", () => {
    const s = newEditor("t");
    for (const [x, y] of [
      [-1, 0],
      [28, 0],
      [0, -1],
      [0, 16],
      [1.5, 1],
    ] as const) {
      expect(paint(s, x, y, TILE.gold)).toBe(s);
    }
  });

  it("placing a runner start where one exists moves it: exactly one P remains", () => {
    let s = paint(newEditor("t"), 2, 2, TILE.runnerStart);
    s = paint(s, 9, 5, TILE.runnerStart);
    expect(count(s, TILE.runnerStart)).toBe(1);
    expect(at(s, 9, 5)).toBe(TILE.runnerStart);
    expect(at(s, 2, 2)).toBe(TILE.empty);
    // Moving it is one undo step.
    expect(count(undo(s), TILE.runnerStart)).toBe(1);
    expect(at(undo(s), 2, 2)).toBe(TILE.runnerStart);
  });

  it("placing a player 2 start where one exists moves it too; P and Q replace each other", () => {
    let s = paint(newEditor("t"), 2, 2, TILE.player2Start);
    s = paint(s, 9, 5, TILE.player2Start);
    expect(count(s, TILE.player2Start)).toBe(1);
    expect(at(s, 9, 5)).toBe(TILE.player2Start);
    expect(at(s, 2, 2)).toBe(TILE.empty);
    // Painting P over Q leaves no Q.
    s = paint(s, 9, 5, TILE.runnerStart);
    expect(count(s, TILE.player2Start)).toBe(0);
    expect(count(s, TILE.runnerStart)).toBe(1);
  });
});

describe("lines", () => {
  it("lineCells covers both ends with no gaps, in every direction and on diagonals", () => {
    const rng = makeRng(21);
    for (let i = 0; i < 500; i++) {
      const [x0, y0, x1, y1] = [
        randInt(rng, 30),
        randInt(rng, 20),
        randInt(rng, 30),
        randInt(rng, 20),
      ];
      const cells = lineCells(x0, y0, x1, y1);
      expect(cells[0]).toEqual([x0, y0]);
      expect(cells.at(-1)).toEqual([x1, y1]);
      expect(cells).toHaveLength(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1);
      for (let k = 1; k < cells.length; k++) {
        const [ax, ay] = cells[k - 1] ?? [0, 0];
        const [bx, by] = cells[k] ?? [0, 0];
        expect(Math.max(Math.abs(bx - ax), Math.abs(by - ay))).toBe(1);
      }
    }
    expect(lineCells(0, 0, 3, 3)).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });

  // Regression (self-review): a non-integer end made the walk never stop.
  it("lineCells gives no cells for ends that are not integers", () => {
    for (const bad of [0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(lineCells(bad, 0, 3, 0)).toEqual([]);
      expect(lineCells(0, 0, 3, bad)).toEqual([]);
    }
  });

  // Regression (self-review): a far-off end walked millions of cells.
  it("paintLine with an end outside the grid paints only the end inside it", () => {
    const s = paintLine(newEditor("t"), 2, 3, 1e6, 3, TILE.brick);
    expect(count(s, TILE.brick)).toBe(1);
    expect(at(s, 2, 3)).toBe(TILE.brick);
    expect(paintLine(newEditor("t"), -5, 0, 0.5, 2, TILE.brick).grid).toEqual(newEditor("t").grid);
  });

  it("paintLine paints every cell of the segment", () => {
    const s = paintLine(newEditor("t"), 10, 2, 2, 2, TILE.bar);
    expect(s.grid[2]?.slice(2, 11)).toBe("-".repeat(9));
    expect(count(s, TILE.bar)).toBe(9);
  });
});

describe("undo and redo", () => {
  it("one mouse stroke (press, drag, release) is one undo step", () => {
    let s = beginStroke(newEditor("t"));
    s = paint(s, 1, 1, TILE.brick);
    s = paintLine(s, 1, 1, 8, 1, TILE.brick);
    s = paint(s, 8, 2, TILE.brick);
    s = endStroke(s);
    expect(s.undo).toHaveLength(1);
    expect(count(undo(s), TILE.brick)).toBe(0);
    // Outside a stroke, each change is its own step.
    s = paint(paint(s, 0, 0, TILE.gold), 1, 0, TILE.gold);
    expect(s.undo).toHaveLength(3);
  });

  // Regression (self-review): Ctrl+Z or a resize during a drag turned the rest of the
  // stroke into one undo step per cell.
  it("after an undo or a resize mid-stroke, the rest of the stroke is one new step", () => {
    let s = paint(beginStroke(newEditor("t")), 1, 1, TILE.brick);
    s = undo(s);
    s = paintLine(s, 2, 1, 6, 1, TILE.brick);
    expect(endStroke(s).undo).toHaveLength(1);

    s = paint(beginStroke(newEditor("t")), 1, 1, TILE.brick);
    s = resize(s, 20, 12);
    s = paintLine(s, 2, 1, 6, 1, TILE.brick);
    s = endStroke(s);
    expect(s.undo).toHaveLength(3); // the first paint, the resize, the rest of the stroke
    expect(count(undo(s), TILE.brick)).toBe(1);
  });

  it("a stroke that changes nothing adds no undo step", () => {
    const s = endStroke(paint(beginStroke(newEditor("t")), 0, 0, TILE.empty));
    expect(s.undo).toEqual([]);
  });

  it("undo then redo restores the exact grid; a new edit clears redo", () => {
    const a = paint(newEditor("t"), 4, 4, TILE.gold);
    const b = paint(a, 5, 5, TILE.exit);
    expect(undo(b).grid).toEqual(a.grid);
    expect(redo(undo(b)).grid).toEqual(b.grid);
    const c = paint(undo(b), 6, 6, TILE.ladder);
    expect(c.redo).toEqual([]);
    expect(redo(c)).toBe(c);
    expect(undo(newEditor("t")).grid).toEqual(newEditor("t").grid);
  });

  it(`keeps at most ${String(UNDO_LIMIT)} steps, dropping the oldest`, () => {
    let s = newEditor("t");
    for (let i = 0; i < UNDO_LIMIT + 20; i++) s = paint(s, i % 28, Math.floor(i / 28), TILE.brick);
    expect(s.undo).toHaveLength(UNDO_LIMIT);
    for (let i = 0; i < UNDO_LIMIT; i++) s = undo(s);
    expect(count(s, TILE.brick)).toBe(20); // the first 20 steps can no longer be undone
    expect(undo(s)).toBe(s);
  });
});

describe("resize and rename", () => {
  it("keeps the top-left content, crops or pads with empty cells", () => {
    const s = paint(paint(newEditor("t"), 0, 0, TILE.gold), 27, 15, TILE.exit);
    const small = resize(s, 10, 8);
    expect(small.grid).toHaveLength(8);
    expect(small.grid.every((row) => row.length === 10)).toBe(true);
    expect(at(small, 0, 0)).toBe(TILE.gold);
    expect(count(small, TILE.exit)).toBe(0);
    const big = resize(small, 30, 20);
    expect(big.grid.every((row) => row.length === 30)).toBe(true);
    expect(big.grid).toHaveLength(20);
    expect(big.grid[19]).toBe(".".repeat(30));
    expect(undo(big).grid).toEqual(small.grid);
  });

  it("is clamped to the format limits (8–64 × 8–48); a same-size resize is a no-op", () => {
    const s = newEditor("t");
    const size = (e: EditorState): [number, number] => [e.grid[0]?.length ?? 0, e.grid.length];
    expect(size(resize(s, 1000, 1000))).toEqual([64, 48]);
    expect(size(resize(s, 0, -5))).toEqual([8, 8]);
    expect(size(resize(s, Number.NaN, 2.5))).toEqual([28, 16]);
    expect(resize(s, 28, 16)).toBe(s);
  });

  // Regression (self-review): trimming on every keystroke made "My level" impossible to type.
  it("rename caps the name at 64 code points and keeps spaces; the document is trimmed", () => {
    const s = newEditor("t");
    expect(rename(s, "My ").name).toBe("My ");
    expect(toDocument(rename(s, "  Gold rush  ")).name).toBe("Gold rush");
    expect(codePoints(rename(s, "é".repeat(70)).name)).toHaveLength(64);
    expect(codePoints(rename(s, "🏃".repeat(70)).name)).toHaveLength(64);
    expect(rename(s, "x").undo).toEqual([]);
  });
});

describe("toLevel", () => {
  const valid = (): EditorState => {
    let s = newEditor("Test");
    s = paint(s, 1, 14, TILE.runnerStart);
    s = paint(s, 5, 14, TILE.gold);
    s = paint(s, 9, 14, TILE.exit);
    return s;
  };

  it("returns a v3 level for a valid grid, in Moss by day unless picked otherwise", () => {
    const r = toLevel(valid());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.level.version).toBe(3);
      expect([r.level.world, r.level.night]).toEqual(["moss", false]);
      expect(r.level.name).toBe("Test");
      expect(r.level.grid).toEqual(valid().grid);
      expect(r.level.teleports).toEqual([]);
    }
  });

  it("keeps the teleporter links of an opened level, and drops a link whose end is painted over", () => {
    let grid = valid().grid;
    grid = grid.map((row, y) => (y === 2 ? `.T....t${row.slice(7)}` : row));
    const opened = editorFrom({
      name: "Links",
      world: "moss",
      night: false,
      width: 28,
      height: 16,
      grid,
      teleports: [[1, 2, 6, 2]],
    });
    const r = toLevel(paint(opened, 20, 2, TILE.brick));
    expect(r.ok && r.level.teleports).toEqual([[1, 2, 6, 2]]);
    expect(toDocument(opened).teleports).toEqual([[1, 2, 6, 2]]);
    // Painting over the entrance takes its link with it: the level stays playable.
    const gone = paint(opened, 1, 2, TILE.brick);
    expect(gone.teleports).toEqual([]);
    expect(toLevel(gone).ok).toBe(true);
    expect(sameContent(opened, { ...opened, teleports: [] })).toBe(false);
  });

  it("returns the validator's error codes for an invalid grid", () => {
    const codes = (s: EditorState): string[] => {
      const r = toLevel(s);
      return r.ok ? [] : r.errors.map((e) => e.code);
    };
    expect(codes(newEditor("t"))).toEqual(
      expect.arrayContaining(["runner-count", "no-gold", "no-exit"]),
    );
    expect(codes(erase(valid(), 5, 14))).toEqual(["no-gold"]);
    expect(codes(erase(valid(), 9, 14))).toEqual(["no-exit"]);
    let crowded = valid();
    for (let i = 0; i < 17; i++) crowded = paint(crowded, i, 3, TILE.monkStart);
    expect(codes(crowded)).toEqual(["too-many-monks"]);
    expect(codes(rename(valid(), "   "))).toEqual(["invalid-name"]);
  });
});

describe("randomized edits", () => {
  it("2,000 random edit sequences never leave the grid out of shape", () => {
    const rng = makeRng(22);
    const tiles = [...TILE_CHARS] as TileChar[];
    let s = newEditor("t");
    for (let i = 0; i < 2000; i++) {
      const x = randInt(rng, 70) - 3;
      const y = randInt(rng, 52) - 2;
      const tile = tiles[randInt(rng, tiles.length)] ?? TILE.empty;
      switch (randInt(rng, 9)) {
        case 0:
          s = beginStroke(s);
          break;
        case 1:
          s = endStroke(s);
          break;
        case 2:
          s = undo(s);
          break;
        case 3:
          s = redo(s);
          break;
        case 4:
          s = resize(s, randInt(rng, 70), randInt(rng, 52));
          break;
        case 5:
          s = paintLine(s, x, y, randInt(rng, 70) - 3, randInt(rng, 52) - 2, tile);
          break;
        case 6:
          s = erase(s, x, y);
          break;
        default:
          s = paint(s, x, y, tile);
      }
      const w = s.grid[0]?.length ?? 0;
      expect(s.grid.length).toBeGreaterThanOrEqual(8);
      expect(s.grid.length).toBeLessThanOrEqual(48);
      expect(w).toBeGreaterThanOrEqual(8);
      expect(w).toBeLessThanOrEqual(64);
      expect(s.grid.every((row) => row.length === w)).toBe(true);
      expect(count(s, TILE.runnerStart)).toBeLessThanOrEqual(1);
      expect(s.undo.length).toBeLessThanOrEqual(UNDO_LIMIT);
    }
  });
});

describe("drafts", () => {
  it("toDraft accepts a level that is not playable yet; only an empty name fails", () => {
    const s = paint(newEditor("WIP"), 3, 3, TILE.brick);
    const r = toDraft(s);
    expect(r.ok && r.level.grid).toEqual(s.grid);
    const bad = toDraft(rename(s, "  "));
    expect(bad.ok ? [] : bad.errors.map((e) => e.code)).toEqual(["invalid-name"]);
  });

  it("editorFrom opens a saved level as it was, with an empty undo history", () => {
    const s = paint(paint(newEditor("Saved"), 3, 3, TILE.brick), 4, 4, TILE.gold);
    const opened = editorFrom({
      name: "Saved",
      world: "moss",
      night: false,
      width: 28,
      height: 16,
      grid: s.grid,
      teleports: [],
    });
    expect(opened.grid).toEqual(s.grid);
    expect(opened.name).toBe("Saved");
    expect(opened.undo).toEqual([]);
    expect(opened.redo).toEqual([]);
  });
});

describe("sameContent", () => {
  it("compares the grid and the trimmed name, not the undo history or the tile", () => {
    const a = newEditor("Level");
    expect(sameContent(a, selectTile(rename(a, " Level  "), TILE.gold))).toBe(true);
    expect(sameContent(a, paint(a, 1, 1, TILE.gold))).toBe(false);
    expect(sameContent(a, undo(paint(a, 1, 1, TILE.gold)))).toBe(true);
    expect(sameContent(a, rename(a, "Other"))).toBe(false);
    expect(sameContent(a, resize(a, 30, 16))).toBe(false);
  });
});

describe("teleporter links", () => {
  /** A blank level with tiles painted at the given cells (row 2). */
  const level = (cells: Record<number, TileChar>): EditorState => {
    let s = newEditor("Links");
    for (const [x, tile] of Object.entries(cells)) s = paint(s, Number(x), 2, tile);
    return s;
  };
  const T = TILE.teleportEntrance;
  const t = TILE.teleportExit;

  it("a new entrance leads to the nearest exit; ties go to the first in reading order", () => {
    // Exits at 2 and 10; an entrance at 6 is 4 from both: the first one (2) wins.
    const s = level({ 2: t, 10: t, 6: T });
    expect(s.teleports).toEqual([[6, 2, 2, 2]]);
    // An entrance at 9 is nearer to 10.
    expect(paint(s, 9, 2, T).teleports).toEqual([
      [6, 2, 2, 2],
      [9, 2, 10, 2],
    ]);
    // Distance is |dx| + |dy|: an exit one row down beats one three columns away.
    expect(relink(["T..t", "t..."], [])).toEqual([[0, 0, 0, 1]]);
  });

  it("an entrance with no exit has no link until an exit is painted", () => {
    const s = level({ 4: T });
    expect(s.teleports).toEqual([]);
    expect(paint(s, 12, 2, t).teleports).toEqual([[4, 2, 12, 2]]);
  });

  it("erasing an exit relinks its entrances to the next nearest one, or drops them", () => {
    const s = level({ 2: t, 10: t, 4: T });
    expect(s.teleports).toEqual([[4, 2, 2, 2]]);
    expect(erase(s, 2, 2).teleports).toEqual([[4, 2, 10, 2]]);
    expect(erase(erase(s, 2, 2), 10, 2).teleports).toEqual([]);
  });

  it("the link tool: click an entrance, then an exit, links them; one undo step", () => {
    let s = selectLinkTool(level({ 2: t, 10: t, 4: T }));
    const steps = s.undo.length;
    s = linkAt(s, 4, 2);
    expect(s.linkFrom).toEqual({ cx: 4, cy: 2 });
    s = linkAt(s, 10, 2);
    expect(s.linkFrom).toBeNull();
    expect(s.teleports).toEqual([[4, 2, 10, 2]]);
    expect(s.undo).toHaveLength(steps + 1);
    // Undo restores the old link, redo the new one.
    expect(undo(s).teleports).toEqual([[4, 2, 2, 2]]);
    expect(redo(undo(s)).teleports).toEqual([[4, 2, 10, 2]]);
    // The chosen link survives other edits.
    expect(paint(s, 20, 5, TILE.brick).teleports).toEqual([[4, 2, 10, 2]]);
  });

  it("the link tool: an exit with no entrance picked, or any other cell, picks nothing", () => {
    const s = selectLinkTool(level({ 2: t, 4: T }));
    expect(linkAt(s, 2, 2)).toEqual(s);
    expect(linkAt(linkAt(s, 4, 2), 7, 2).linkFrom).toBeNull();
    expect(linkAt(linkAt(s, 4, 2), 99, 99).linkFrom).toBeNull();
    // Re-linking an entrance to the exit it already has adds no undo step.
    const same = linkAt(linkAt(s, 4, 2), 2, 2);
    expect(same.undo).toHaveLength(s.undo.length);
    // Regression (self-review): with another link after it, the list was reordered,
    // which counted as a change.
    const two = paint(paint(s, 13, 2, t), 12, 2, T);
    expect(two.teleports).toEqual([
      [4, 2, 2, 2],
      [12, 2, 13, 2],
    ]);
    const relinked = linkAt(linkAt(two, 4, 2), 2, 2);
    expect(relinked.teleports).toEqual(two.teleports);
    expect(relinked.undo).toHaveLength(two.undo.length);
    expect(sameContent(relinked, two)).toBe(true);
    // Choosing a tile leaves the link tool and drops the pick.
    expect(selectTile(linkAt(s, 4, 2), TILE.brick)).toMatchObject({
      tool: "paint",
      linkFrom: null,
    });
  });

  it("painting over the picked entrance drops the pick", () => {
    const s = linkAt(selectLinkTool(level({ 2: t, 4: T })), 4, 2);
    expect(paint(s, 4, 2, TILE.brick).linkFrom).toBeNull();
    expect(paint(s, 9, 9, TILE.brick).linkFrom).toEqual({ cx: 4, cy: 2 });
  });

  it("editorFrom repairs the links of an opened draft", () => {
    const opened = editorFrom({
      name: "Draft",
      world: "moss",
      night: false,
      width: 8,
      height: 8,
      grid: ["T.t.....", "t.......", ...Array.from({ length: 6 }, () => "........")],
      // A link to a cell that is not an exit, and a second link for the same entrance.
      teleports: [
        [0, 0, 1, 0],
        [0, 0, 2, 0],
        [0, 0, 0, 1],
      ],
    });
    expect(opened.teleports).toEqual([[0, 0, 2, 0]]);
  });

  // Randomized: random edits with teleporters, the link tool, undo and redo. After every
  // step the links are exactly what relink keeps (a fixed point), every entrance has a
  // link when the grid has an exit, and a playable grid has no link error.
  it("random edit sequences always leave valid links", () => {
    const rng = makeRng(2302);
    const tiles: TileChar[] = [T, t, T, t, TILE.brick, TILE.empty];
    for (let trial = 0; trial < 300; trial++) {
      let s = newEditor("R");
      s = paint(s, 0, 15, TILE.runnerStart);
      s = paint(s, 1, 14, TILE.gold);
      s = paint(s, 2, 14, TILE.exit);
      for (let i = 0; i < 30; i++) {
        const x = randInt(rng, 8);
        const y = randInt(rng, 4);
        const op = randInt(rng, 7);
        if (op === 0) s = undo(s);
        else if (op === 1) s = redo(s);
        else if (op === 2) s = linkAt(selectLinkTool(s), x, y);
        else s = paint(s, x, y, tiles[randInt(rng, tiles.length)] ?? TILE.empty);
        expect(relink(s.grid, s.teleports)).toEqual(s.teleports);
        const hasExit = s.grid.some((row) => row.includes(t));
        const entrances = s.grid
          .join("")
          .split("")
          .filter((c) => c === T).length;
        expect(s.teleports).toHaveLength(hasExit ? entrances : 0);
        const r = toLevel(s);
        const codes = r.ok ? [] : r.errors.map((e) => e.code);
        expect(codes.filter((c) => c.startsWith("teleport") && c !== "teleport-unlinked")).toEqual(
          [],
        );
        if (hasExit) expect(codes).not.toContain("teleport-unlinked");
      }
    }
  });
});

describe("world and night", () => {
  it("a new level is in Moss, by day", () => {
    const s = newEditor("New");
    expect([s.world, s.night]).toEqual(["moss", false]);
  });

  it("picking a world or night changes the level: unsaved, and in what is saved and played", () => {
    const s = newEditor("Pick");
    const lava = setNight(setWorld(s, "lava"), true);
    expect(sameContent(s, setWorld(s, "lava"))).toBe(false);
    expect(sameContent(s, setNight(s, true))).toBe(false);
    expect(sameContent(s, setNight(setWorld(lava, "moss"), false))).toBe(true);
    const doc = toDocument(lava);
    expect([doc.world, doc.night]).toEqual(["lava", true]);
    const draft = toDraft(lava);
    expect(draft.ok && [draft.level.world, draft.level.night]).toEqual(["lava", true]);
  });

  it("is not an undo step: undo goes back over the grid only", () => {
    const painted = paint(newEditor("U"), 2, 2, TILE.brick);
    const picked = setWorld(painted, "ice");
    const back = undo(picked);
    expect(back.world).toBe("ice");
    expect(back.grid).toEqual(newEditor("U").grid);
  });

  it("editorFrom opens a level in its world, by its day or night", () => {
    const opened = editorFrom({
      name: "Ice",
      world: "ice",
      night: true,
      width: 8,
      height: 8,
      grid: Array<string>(8).fill(".".repeat(8)),
      teleports: [],
    });
    expect([opened.world, opened.night]).toEqual(["ice", true]);
  });
});
