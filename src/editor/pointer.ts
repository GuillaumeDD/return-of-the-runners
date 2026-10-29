import { TILE } from "../level/format";
import { beginStroke, endStroke, erase, linkAt, paint, paintLine, type EditorState } from "./model";

/**
 * Mouse painting, as pure functions: the DOM layer turns pointer events into
 * `PointerInput`s and canvas pixels into cells, and this module turns them into editor
 * operations. Kept out of the DOM so it is unit-testable.
 */

export interface Cell {
  readonly x: number;
  readonly y: number;
}

/**
 * The cell under a point of the canvas, in CSS pixels from its top-left corner. The
 * canvas may be shown at any CSS size (`displayWidth` × `displayHeight`), so the point
 * is scaled to the grid (`columns` × `rows`). Outside the canvas: null.
 */
export function cellAt(
  px: number,
  py: number,
  displayWidth: number,
  displayHeight: number,
  columns: number,
  rows: number,
): Cell | null {
  if (!(displayWidth > 0 && displayHeight > 0)) return null;
  const x = Math.floor((px * columns) / displayWidth);
  const y = Math.floor((py * rows) / displayHeight);
  if (!(x >= 0 && x < columns && y >= 0 && y < rows)) return null; // also rejects NaN
  return { x, y };
}

export type PointerAction = "paint" | "erase";

/** Left button paints the selected tile, right button erases; other buttons do nothing. */
export function actionFor(button: number): PointerAction | null {
  if (button === 0) return "paint";
  if (button === 2) return "erase";
  return null;
}

/** `PointerEvent.buttons` bit of an acting button: 1 for the left one, 2 for the right one. */
function buttonBit(button: number): number {
  return button === 2 ? 2 : 1;
}

/**
 * A press in progress: which pointer and button, what it does, and the last cell it
 * touched (null when off the grid).
 */
export interface Drag {
  readonly pointer: number;
  readonly button: number;
  readonly action: PointerAction;
  readonly last: Cell | null;
}

/** Whether a press starts a drag: a button that acts, and no drag already going. */
export function startsDrag(drag: Drag | null, button: number): boolean {
  return drag === null && actionFor(button) !== null;
}

/**
 * `down`: a button pressed on the canvas. `move`: the pointer moved (cell null when off
 * the grid; `buttons` is the bit mask of the buttons still held). `end`: released,
 * cancelled, or capture lost: the DOM layer sends it for all three, so a release outside
 * the window still ends the stroke. Inputs from another pointer than the drag's (a
 * second finger) are ignored.
 */
export type PointerInput =
  | {
      readonly kind: "down";
      readonly pointer: number;
      readonly button: number;
      readonly cell: Cell | null;
    }
  | {
      readonly kind: "move";
      readonly pointer: number;
      readonly buttons: number;
      readonly cell: Cell | null;
    }
  | { readonly kind: "end"; readonly pointer: number };

export interface PointerResult {
  readonly editor: EditorState;
  readonly drag: Drag | null;
}

/**
 * Applies one pointer input: a whole press, drag and release is one undo step. With the
 * link tool, a left click links teleporters (`linkAt`) and starts no drag; the right
 * button still erases.
 */
export function onPointer(
  editor: EditorState,
  drag: Drag | null,
  input: PointerInput,
): PointerResult {
  if (input.kind !== "down" && (drag === null || input.pointer !== drag.pointer)) {
    return { editor, drag };
  }
  switch (input.kind) {
    case "down": {
      const action = actionFor(input.button);
      // A second button during a drag, or a button that does nothing: ignored.
      if (!startsDrag(drag, input.button) || action === null) return { editor, drag };
      if (action === "paint" && editor.tool === "link") {
        if (input.cell === null) return { editor, drag };
        return { editor: linkAt(editor, input.cell.x, input.cell.y), drag };
      }
      let s = beginStroke(editor);
      if (input.cell !== null) s = apply(s, action, input.cell, input.cell);
      const next = { pointer: input.pointer, button: input.button, action, last: input.cell };
      return { editor: s, drag: next };
    }
    case "move": {
      if (drag === null) return { editor, drag };
      // The drag's button was let go while another one is still held (no pointerup
      // fires until all are up): the stroke ends here.
      if ((input.buttons & buttonBit(drag.button)) === 0) {
        return { editor: endStroke(editor), drag: null };
      }
      const { cell } = input;
      if (cell === null) return { editor, drag: { ...drag, last: null } };
      // Back on the grid after leaving it: start again here, no line across the outside.
      const s = apply(editor, drag.action, drag.last ?? cell, cell);
      return { editor: s, drag: { ...drag, last: cell } };
    }
    case "end":
      return { editor: endStroke(editor), drag: null };
  }
}

function apply(s: EditorState, action: PointerAction, from: Cell, to: Cell): EditorState {
  if (from.x === to.x && from.y === to.y) {
    return action === "paint" ? paint(s, to.x, to.y) : erase(s, to.x, to.y);
  }
  const tile = action === "paint" ? s.tile : TILE.empty;
  return paintLine(s, from.x, from.y, to.x, to.y, tile);
}
