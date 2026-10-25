import { TILE } from "../level/format";
import { cellOf } from "./physics";
import { SUB } from "./rules";
import type { Actor } from "./state";

/** Number of gold tiles in a grid. */
export function countGold(tiles: readonly string[]): number {
  let n = 0;
  for (const row of tiles) for (const ch of row) if (ch === TILE.gold) n++;
  return n;
}

/**
 * The cell holding the actor's centre. An actor "touches" a cell (gold, exit) once its
 * centre is inside it, so it does not need to be aligned (provisional, see ARCHITECTURE).
 */
export function centerCell(a: Actor): { cx: number; cy: number } {
  return { cx: cellOf(a.x + SUB / 2), cy: cellOf(a.y + SUB / 2) };
}

/** Returns the tiles with the gold at (cx, cy) removed, or `null` if there is none. */
export function takeGold(tiles: readonly string[], cx: number, cy: number): string[] | null {
  const row = tiles[cy];
  if (row?.charAt(cx) !== TILE.gold) return null;
  return setTile(tiles, cx, cy, TILE.empty);
}

/** Returns the tiles with the cell (cx, cy) set to `tile`. */
export function setTile(tiles: readonly string[], cx: number, cy: number, tile: string): string[] {
  return tiles.map((r, y) => (y === cy ? r.slice(0, cx) + tile + r.slice(cx + 1) : r));
}
