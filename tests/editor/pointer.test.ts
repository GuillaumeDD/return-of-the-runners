import { describe, expect, it } from "vitest";
import { TILE } from "../../src/level/format";
import {
  newEditor,
  paint,
  selectLinkTool,
  selectTile,
  undo,
  type EditorState,
} from "../../src/editor/model";
import {
  actionFor,
  cellAt,
  onPointer,
  startsDrag,
  type Cell,
  type Drag,
  type PointerInput,
} from "../../src/editor/pointer";

const count = (s: EditorState, tile: string): number =>
  s.grid
    .join("")
    .split("")
    .filter((c) => c === tile).length;

const cell = (x: number, y: number): Cell => ({ x, y });
/** A press of `button` (0 left, 2 right) on a cell (null: off the grid), by pointer 1. */
const down = (button: number, c: Cell | null, pointer = 1): PointerInput => ({
  kind: "down",
  pointer,
  button,
  cell: c,
});
/** A move with the left button held, unless `buttons` says otherwise. */
const move = (c: Cell | null, buttons = 1, pointer = 1): PointerInput => ({
  kind: "move",
  pointer,
  buttons,
  cell: c,
});
const end = (pointer = 1): PointerInput => ({ kind: "end", pointer });

/** Runs a sequence of pointer inputs from a given state. */
function run(
  start: EditorState,
  inputs: readonly PointerInput[],
): { editor: EditorState; drag: Drag | null } {
  let editor = start;
  let drag: Drag | null = null;
  for (const input of inputs) ({ editor, drag } = onPointer(editor, drag, input));
  return { editor, drag };
}

describe("cellAt", () => {
  it("maps the corners and edges of each cell, at any CSS scale of the canvas", () => {
    // A 28×16 grid drawn at 672×384 pixels, shown at half, natural, double and odd sizes.
    for (const scale of [0.5, 1, 2, 0.731]) {
      const w = 672 * scale;
      const h = 384 * scale;
      const cell = 24 * scale;
      for (const [cx, cy] of [
        [0, 0],
        [27, 15],
        [5, 9],
      ] as const) {
        const left = cx * cell;
        const top = cy * cell;
        // Top-left corner, just inside the bottom-right corner, and the middle.
        for (const [px, py] of [
          [left, top],
          [left + cell - 0.01, top + cell - 0.01],
          [left + cell / 2, top + cell / 2],
        ] as const) {
          expect(cellAt(px, py, w, h, 28, 16), `${String(scale)} ${String(px)}`).toEqual({
            x: cx,
            y: cy,
          });
        }
      }
    }
  });

  it("outside the canvas, or on a canvas with no size, there is no cell", () => {
    for (const [px, py] of [
      [-0.01, 10],
      [10, -0.01],
      [672, 10],
      [10, 384],
      [Number.NaN, 10],
    ] as const) {
      expect(cellAt(px, py, 672, 384, 28, 16)).toBeNull();
    }
    expect(cellAt(0, 0, 0, 0, 28, 16)).toBeNull();
    expect(cellAt(0, 0, 672, 384, 0, 0)).toBeNull();
  });
});

describe("buttons", () => {
  it("left button paints, right button erases, other buttons do nothing", () => {
    expect(actionFor(0)).toBe("paint");
    expect(actionFor(2)).toBe("erase");
    for (const b of [1, 3, 4, -1]) expect(actionFor(b)).toBeNull();
    expect(startsDrag(null, 0)).toBe(true);
    expect(startsDrag(null, 1)).toBe(false);
  });

  it("a click paints the selected tile; a right click erases", () => {
    const s = selectTile(newEditor("t"), TILE.ladder);
    const painted = run(s, [down(0, cell(3, 4)), end()]);
    expect(painted.editor.grid[4]?.charAt(3)).toBe(TILE.ladder);
    const erased = run(painted.editor, [down(2, cell(3, 4)), end()]);
    expect(erased.editor.grid[4]?.charAt(3)).toBe(TILE.empty);
  });

  it("the middle button, and a second button during a drag, change nothing", () => {
    const s = newEditor("t");
    expect(run(s, [down(1, cell(1, 1))]).editor).toBe(s);
    const { editor } = run(s, [down(0, cell(1, 1)), down(2, cell(1, 1)), end()]);
    expect(editor.grid[1]?.charAt(1)).toBe(TILE.brick);
    expect(startsDrag(run(s, [down(0, cell(1, 1))]).drag, 2)).toBe(false);
  });

  // Regression (self-review): with the right button pressed during a left drag, letting
  // go of the left one fires no pointerup, and the drag kept painting.
  it("letting go of the drag's button while another is held ends the stroke", () => {
    const { editor, drag } = run(newEditor("t"), [
      down(0, cell(1, 1)),
      move(cell(3, 1), 1 | 2), // right button pressed too
      move(cell(8, 1), 2), // left button released
      move(cell(9, 1), 2),
    ]);
    expect(drag).toBeNull();
    expect(editor.stroke).toBe("none");
    expect(editor.grid[1]?.slice(0, 10)).toBe(".###......");
  });
});

describe("drags", () => {
  it("a drag paints every cell on its path, with no gaps, as one undo step", () => {
    const { editor, drag } = run(newEditor("t"), [
      down(0, cell(1, 2)),
      move(cell(9, 2)), // a fast move skips cells
      move(cell(9, 6)),
      end(),
    ]);
    expect(drag).toBeNull();
    expect(editor.grid[2]?.slice(1, 10)).toBe("#".repeat(9));
    expect(count(editor, TILE.brick)).toBe(9 + 4);
    expect(editor.undo).toHaveLength(1);
    expect(count(undo(editor), TILE.brick)).toBe(0);
  });

  it("a right-button drag erases along its path", () => {
    let s = newEditor("t");
    for (let x = 0; x < 10; x++) s = paint(s, x, 3, TILE.gold);
    const { editor } = run(s, [down(2, cell(2, 3)), move(cell(7, 3), 2), end()]);
    expect(editor.grid[3]?.slice(0, 10)).toBe("$$......$$");
  });

  it("leaving the grid and coming back elsewhere draws no line across the outside", () => {
    const { editor } = run(newEditor("t"), [
      down(0, cell(0, 0)),
      move(null),
      move(cell(10, 0)),
      end(),
    ]);
    expect(count(editor, TILE.brick)).toBe(2);
    expect(editor.undo).toHaveLength(1);
  });

  it("moves with no button pressed paint nothing", () => {
    const s = newEditor("t");
    expect(run(s, [move(cell(3, 3))]).editor).toBe(s);
  });

  // Regression (self-review): on a touch screen, a second finger's moves painted a line
  // from the first finger's cell, and lifting it ended the first finger's stroke.
  it("another pointer's moves and release are ignored during a drag", () => {
    const { editor, drag } = run(newEditor("t"), [
      down(0, cell(2, 2), 1),
      down(0, cell(20, 10), 2),
      move(cell(20, 11), 1, 2),
      end(2),
      move(cell(4, 2), 1, 1),
    ]);
    expect(count(editor, TILE.brick)).toBe(3);
    expect(drag?.pointer).toBe(1);
    expect(editor.stroke).toBe("saved");
  });

  // The DOM layer sends "end" on release, cancel and lost capture, so a release outside
  // the window still ends the stroke.
  it("after a stroke ends, the next click is a separate undo step", () => {
    const { editor } = run(newEditor("t"), [
      down(0, cell(1, 1)),
      end(),
      down(0, cell(5, 5)),
      end(),
    ]);
    expect(editor.undo).toHaveLength(2);
    expect(editor.stroke).toBe("none");
  });
});

describe("the link tool", () => {
  const level = (): EditorState => {
    let s = newEditor("Links");
    s = paint(s, 2, 3, TILE.teleportExit);
    s = paint(s, 9, 3, TILE.teleportExit);
    s = paint(s, 5, 3, TILE.teleportEntrance);
    return selectLinkTool(s);
  };

  it("a left click links instead of painting, and starts no drag", () => {
    const s = level();
    const picked = run(s, [down(0, cell(5, 3))]);
    expect(picked.drag).toBeNull();
    expect(picked.editor.linkFrom).toEqual({ cx: 5, cy: 3 });
    expect(picked.editor.grid).toEqual(s.grid);
    const linked = run(s, [down(0, cell(5, 3)), end(), down(0, cell(9, 3)), end()]);
    expect(linked.editor.teleports).toEqual([[5, 3, 9, 3]]);
    expect(linked.editor.grid).toEqual(s.grid);
    // Dragging across cells with the link tool paints nothing.
    const dragged = run(s, [down(0, cell(0, 0)), move(cell(6, 0)), end()]);
    expect(dragged.editor.grid).toEqual(s.grid);
    // A click off the grid does nothing.
    expect(run(s, [down(0, null)]).editor).toEqual(s);
  });

  it("the right button still erases", () => {
    const s = level();
    const erased = run(s, [down(2, cell(5, 3)), end()]);
    expect(count(erased.editor, TILE.teleportEntrance)).toBe(0);
    expect(erased.editor.teleports).toEqual([]);
  });
});
