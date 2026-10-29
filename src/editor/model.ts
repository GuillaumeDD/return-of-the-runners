import {
  LIMITS,
  TILE,
  codePoints,
  type LevelDraft,
  type ParseResult,
  type Teleport,
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
 * Undo covers the grid and the teleporter links (painting, resizing, linking); the
 * name is a text field with its own undo in the browser.
 */
export interface EditorState {
  readonly grid: readonly string[];
  readonly name: string;
  /**
   * The level's teleporter links. They follow the grid: a link whose entrance or exit
   * is erased goes, and an entrance without a link gets one to the nearest exit
   * (`relink`). The link tool changes where an entrance leads.
   */
  readonly teleports: readonly Teleport[];
  /** The tile the left button paints. */
  readonly tile: TileChar;
  /** What the left button does: paint `tile`, or link teleporters. */
  readonly tool: "paint" | "link";
  /** With the link tool: the entrance picked, waiting for the exit it should lead to. */
  readonly linkFrom: { readonly cx: number; readonly cy: number } | null;
  /** Earlier versions, oldest first, at most `UNDO_LIMIT`. */
  readonly undo: readonly Snapshot[];
  readonly redo: readonly Snapshot[];
  /**
   * A mouse stroke is in progress: its first change saves an undo step, the rest of
   * the stroke joins it. `"saved"` once that step exists.
   */
  readonly stroke: "none" | "open" | "saved";
}

/** What undo restores. */
export interface Snapshot {
  readonly grid: readonly string[];
  readonly teleports: readonly Teleport[];
}

export const UNDO_LIMIT = 100;

export function newEditor(name: string): EditorState {
  return {
    grid: blankGrid(),
    name: cleanName(name),
    teleports: [],
    tile: TILE.brick,
    tool: "paint",
    linkFrom: null,
    undo: [],
    redo: [],
    stroke: "none",
  };
}

/**
 * Whether two states hold the same level (grid, teleporter links, and name as saved, so trailing spaces in
 * the name field do not count): what "unsaved changes" compares.
 */
export function sameContent(a: EditorState, b: EditorState): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    JSON.stringify(a.teleports) === JSON.stringify(b.teleports) &&
    a.grid.length === b.grid.length &&
    a.grid.every((row, y) => row === b.grid[y])
  );
}

/** Opens a saved level (or draft) for editing, with an empty undo history. */
export function editorFrom(level: LevelDraft): EditorState {
  return {
    ...newEditor(level.name),
    grid: [...level.grid],
    teleports: relink(level.grid, level.teleports),
  };
}

export function selectTile(s: EditorState, tile: TileChar): EditorState {
  return { ...s, tile, tool: "paint", linkFrom: null };
}

/** The link tool: click an entrance, then the exit it should lead to. */
export function selectLinkTool(s: EditorState): EditorState {
  return { ...s, tool: "link", linkFrom: null };
}

/**
 * A click with the link tool: on an entrance, picks it; then on an exit, links the
 * picked entrance to it (one undo step). Anywhere else, drops the pick.
 */
export function linkAt(s: EditorState, cx: number, cy: number): EditorState {
  const tile = tileAt(s.grid, cx, cy);
  if (tile === TILE.teleportEntrance) return { ...s, linkFrom: { cx, cy } };
  const from = s.linkFrom;
  if (tile !== TILE.teleportExit || from === null) return { ...s, linkFrom: null };
  const link: Teleport = [from.cx, from.cy, cx, cy];
  // In place, so re-linking an entrance to its own exit changes nothing.
  const own = (l: Teleport): boolean => l[0] === from.cx && l[1] === from.cy;
  const teleports = s.teleports.some(own)
    ? s.teleports.map((l) => (own(l) ? link : l))
    : [...s.teleports, link];
  const done = { ...s, linkFrom: null };
  if (JSON.stringify(teleports) === JSON.stringify(s.teleports)) return done;
  // A link is its own undo step, even in the middle of a stroke.
  return resume(s, record({ ...done, stroke: "none" }, { grid: s.grid, teleports }));
}

/**
 * The links that fit a grid: those from an entrance (`T`) to an exit (`t`), the first
 * one of each entrance, in their order; then one for each entrance left without, to the
 * nearest exit (by |dx| + |dy|, ties to the first in reading order), if there is one.
 */
export function relink(grid: readonly string[], links: readonly Teleport[]): Teleport[] {
  const at = (x: number, y: number): string | undefined => tileAt(grid, x, y);
  const linked = new Set<string>();
  const kept: Teleport[] = [];
  for (const link of links) {
    const [fx, fy, tx, ty] = link;
    const key = `${String(fx)},${String(fy)}`;
    if (at(fx, fy) !== TILE.teleportEntrance || at(tx, ty) !== TILE.teleportExit) continue;
    if (linked.has(key)) continue;
    linked.add(key);
    kept.push(link);
  }
  const exits: [number, number][] = [];
  const entrances: [number, number][] = [];
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row.charAt(x) === TILE.teleportExit) exits.push([x, y]);
      if (row.charAt(x) === TILE.teleportEntrance) entrances.push([x, y]);
    }
  });
  for (const [x, y] of entrances) {
    if (linked.has(`${String(x)},${String(y)}`)) continue;
    let best: [number, number] | null = null;
    let bestDistance = Infinity;
    for (const [ex, ey] of exits) {
      const d = Math.abs(ex - x) + Math.abs(ey - y);
      if (d < bestDistance) {
        best = [ex, ey];
        bestDistance = d;
      }
    }
    if (best !== null) kept.push([x, y, best[0], best[1]]);
  }
  return kept;
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
  // One start per player: placing it moves it.
  if (tile === TILE.runnerStart || tile === TILE.player2Start) {
    const y = grid.findIndex((row) => row.includes(tile));
    if (y >= 0) grid = setCell(grid, grid[y]?.indexOf(tile) ?? 0, y, TILE.empty);
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
    ...previous,
    linkFrom: null,
    undo: s.undo.slice(0, -1),
    redo: [...s.redo, snapshot(s)],
    stroke: reopened(s),
  };
}

export function redo(s: EditorState): EditorState {
  const next = s.redo[s.redo.length - 1];
  if (next === undefined) return s;
  return {
    ...s,
    ...next,
    linkFrom: null,
    undo: capped([...s.undo, snapshot(s)]),
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

/** The edited level as a v2 document, through the same validator as any imported level. */
export function toLevel(s: EditorState): ParseResult {
  return parseLevel(JSON.stringify(toDocument(s)));
}

export function toDocument(s: EditorState): Record<string, unknown> {
  return levelDocument({
    name: s.name.trim(),
    width: s.grid[0]?.length ?? 0,
    height: s.grid.length,
    grid: s.grid,
    teleports: s.teleports,
  });
}

/** A grid change; the teleporter links follow it (`relink`). */
function change(s: EditorState, grid: readonly string[]): EditorState {
  return record(s, { grid, teleports: relink(grid, s.teleports) });
}

/** A new version of the level, with its undo step (unless the stroke has one already). */
function record(s: EditorState, next: Snapshot): EditorState {
  const linkFrom =
    s.linkFrom !== null && tileAt(next.grid, s.linkFrom.cx, s.linkFrom.cy) === TILE.teleportEntrance
      ? s.linkFrom
      : null;
  if (s.stroke === "saved") return { ...s, ...next, linkFrom };
  return {
    ...s,
    ...next,
    linkFrom,
    undo: capped([...s.undo, snapshot(s)]),
    redo: [],
    stroke: s.stroke === "open" ? "saved" : s.stroke,
  };
}

function snapshot(s: EditorState): Snapshot {
  return { grid: s.grid, teleports: s.teleports };
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

function capped(stack: Snapshot[]): Snapshot[] {
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
