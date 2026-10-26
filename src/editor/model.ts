import {
  LIMITS,
  TILE,
  codePoints,
  type LevelDraft,
  type ParseResult,
  type TileChar,
} from "../level/format";
import { parseLevel } from "../level/parse";
import { levelDocument } from "../level/serialize";
import { blankGrid, clampSize } from "./blank";

/**
 * The level editor's model: plain data and pure functions, like the simulation, so
 * the editor is unit-testable without a browser. The DOM layer only turns mouse and
 * keyboard events into these operations.
 *
 * Undo covers the grid (painting, resizing); the name is a text field with its own
 * undo in the browser.
 */
export interface EditorState {
  readonly grid: readonly string[];
  readonly name: string;
  /** The tile the left button paints. */
  readonly tile: TileChar;
  /** Earlier grids, oldest first, at most `UNDO_LIMIT`. */
  readonly undo: readonly (readonly string[])[];
  readonly redo: readonly (readonly string[])[];
  /**
   * A mouse stroke is in progress: its first change saves an undo step, the rest of
   * the stroke joins it. `"saved"` once that step exists.
   */
  readonly stroke: "none" | "open" | "saved";
}

export const UNDO_LIMIT = 100;

export function newEditor(name: string): EditorState {
  return {
    grid: blankGrid(),
    name: cleanName(name),
    tile: TILE.brick,
    undo: [],
    redo: [],
    stroke: "none",
  };
}

/**
 * Whether two states hold the same level (grid and name as saved, so trailing spaces in
 * the name field do not count): what "unsaved changes" compares.
 */
export function sameContent(a: EditorState, b: EditorState): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.grid.length === b.grid.length &&
    a.grid.every((row, y) => row === b.grid[y])
  );
}

/** Opens a saved level (or draft) for editing, with an empty undo history. */
export function editorFrom(level: LevelDraft): EditorState {
  return { ...newEditor(level.name), grid: [...level.grid] };
}

export function selectTile(s: EditorState, tile: TileChar): EditorState {
  return { ...s, tile };
}

export function beginStroke(s: EditorState): EditorState {
  return { ...s, stroke: "open" };
}

export function endStroke(s: EditorState): EditorState {
  return { ...s, stroke: "none" };
}

/** Sets one cell to `tile` (the selected tile by default). Out of the grid: no change. */
export function paint(
  s: EditorState,
  cx: number,
  cy: number,
  tile: TileChar = s.tile,
): EditorState {
  const current = tileAt(s.grid, cx, cy);
  if (current === undefined || current === tile) return s;
  let grid = s.grid;
  // Exactly one runner start: placing it moves it.
  if (tile === TILE.runnerStart) {
    const y = grid.findIndex((row) => row.includes(TILE.runnerStart));
    if (y >= 0) grid = setCell(grid, grid[y]?.indexOf(TILE.runnerStart) ?? 0, y, TILE.empty);
  }
  grid = setCell(grid, cx, cy, tile);
  return change(s, grid);
}

export function erase(s: EditorState, cx: number, cy: number): EditorState {
  return paint(s, cx, cy, TILE.empty);
}

/**
 * Paints every cell on the segment from (x0, y0) to (x1, y1), ends included
 * (Bresenham), so a fast mouse drag leaves no gaps. Both ends must be cells of the
 * grid; otherwise only the end that is one gets painted, so a bad coordinate can never
 * make the walk long.
 */
export function paintLine(
  s: EditorState,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tile: TileChar = s.tile,
): EditorState {
  if (tileAt(s.grid, x0, y0) === undefined || tileAt(s.grid, x1, y1) === undefined) {
    return paint(paint(s, x0, y0, tile), x1, y1, tile);
  }
  let out = s;
  for (const [x, y] of lineCells(x0, y0, x1, y1)) out = paint(out, x, y, tile);
  return out;
}

/**
 * The cells of a segment, ends included, each one touching the previous (8-way).
 * Integer ends only: anything else gives no cells (the walk would never end).
 */
export function lineCells(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const cells: [number, number][] = [];
  if (![x0, y0, x1, y1].every(Number.isSafeInteger)) return cells;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    cells.push([x, y]);
    if (x === x1 && y === y1) return cells;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Keeps the top-left content, crops or pads with empty cells; clamped to the format limits. */
export function resize(s: EditorState, width: number, height: number): EditorState {
  const w = clampSize(
    width,
    LIMITS.minWidth,
    LIMITS.maxWidth,
    s.grid[0]?.length ?? LIMITS.minWidth,
  );
  const h = clampSize(height, LIMITS.minHeight, LIMITS.maxHeight, s.grid.length);
  const grid = Array.from({ length: h }, (_, y) =>
    (s.grid[y] ?? "").slice(0, w).padEnd(w, TILE.empty),
  );
  if (grid.length === s.grid.length && grid.every((row, y) => row === s.grid[y])) return s;
  // A resize is its own undo step, even in the middle of a stroke.
  return resume(s, change({ ...s, stroke: "none" }, grid));
}

/**
 * Caps the name at 64 code points, without trimming it: the name field updates the
 * state on every keystroke, and trimming there would eat the space between two words.
 * The saved document is trimmed (`toDocument`).
 */
export function rename(s: EditorState, name: string): EditorState {
  return { ...s, name: codePoints(name).slice(0, LIMITS.maxNameLength).join("") };
}

export function undo(s: EditorState): EditorState {
  const previous = s.undo[s.undo.length - 1];
  if (previous === undefined) return s;
  return {
    ...s,
    grid: previous,
    undo: s.undo.slice(0, -1),
    redo: [...s.redo, s.grid],
    stroke: reopened(s),
  };
}

export function redo(s: EditorState): EditorState {
  const next = s.redo[s.redo.length - 1];
  if (next === undefined) return s;
  return {
    ...s,
    grid: next,
    undo: capped([...s.undo, s.grid]),
    redo: s.redo.slice(0, -1),
    stroke: reopened(s),
  };
}

/**
 * The edited level as a draft, for saving: checked for its shape only, so a level can be
 * saved before it is playable. The editor always produces a valid shape; only an empty
 * name fails, and returns the validator's errors.
 */
export function toDraft(s: EditorState): ParseResult {
  return parseLevel(JSON.stringify(toDocument(s)), { gameRules: false });
}

/** The edited level as a v1 document, through the same validator as any imported level. */
export function toLevel(s: EditorState): ParseResult {
  return parseLevel(JSON.stringify(toDocument(s)));
}

export function toDocument(s: EditorState): Record<string, unknown> {
  return levelDocument({
    name: s.name.trim(),
    width: s.grid[0]?.length ?? 0,
    height: s.grid.length,
    grid: s.grid,
  });
}

function change(s: EditorState, grid: readonly string[]): EditorState {
  if (s.stroke === "saved") return { ...s, grid };
  return {
    ...s,
    grid,
    undo: capped([...s.undo, s.grid]),
    redo: [],
    stroke: s.stroke === "open" ? "saved" : s.stroke,
  };
}

/**
 * After an undo, redo or resize in the middle of a stroke, the rest of the stroke is a
 * new undo step (not one step per cell, not merged into the step before).
 */
function reopened(s: EditorState): EditorState["stroke"] {
  return s.stroke === "none" ? "none" : "open";
}

function resume(before: EditorState, after: EditorState): EditorState {
  return { ...after, stroke: reopened(before) };
}

function capped(stack: (readonly string[])[]): (readonly string[])[] {
  return stack.length > UNDO_LIMIT ? stack.slice(stack.length - UNDO_LIMIT) : stack;
}

function tileAt(grid: readonly string[], cx: number, cy: number): string | undefined {
  const row = grid[cy];
  if (row === undefined || !Number.isInteger(cx) || cx < 0 || cx >= row.length) return undefined;
  return row.charAt(cx);
}

function setCell(grid: readonly string[], cx: number, cy: number, tile: string): string[] {
  return grid.map((row, y) => (y === cy ? row.slice(0, cx) + tile + row.slice(cx + 1) : row));
}

function cleanName(name: string): string {
  return codePoints(name.trim()).slice(0, LIMITS.maxNameLength).join("");
}
