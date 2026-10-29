import { DOOR_KEY, TILE } from "../level/format";
import { centerCell, setTile } from "./gold";
import type { Player } from "./state";

/**
 * Items and the item slot (S-016 @ 3:03–3:33). Items lie in cells of `tiles`, like
 * gold, and actors pass through them. Each player has one slot (`Player.item`, `""`
 * when empty). The pick-up key acts once per press: on an item, the player takes it and
 * leaves the item it held there (a swap); on an empty cell, it drops the held item. Keys
 * are the first items; tools come with their own items.
 *
 * A door is solid. A player carrying the key of its colour that stands next to it
 * (left, right, above or below its centre cell) opens it for good, and the key is used
 * up. Monks never take items.
 */

/** The item tiles: each key. */
export const ITEMS: ReadonlySet<string> = new Set([TILE.keyRed, TILE.keyGreen, TILE.keyBlue]);

export function isItem(tile: string): boolean {
  return ITEMS.has(tile);
}

export function isDoor(tile: string): boolean {
  return Object.hasOwn(DOOR_KEY, tile);
}

/** The four cells next to (cx, cy), in a fixed order: left, right, above, below. */
const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * A press of the pick-up key, at the player's centre cell: take the item there (leaving
 * the held one in its place), or drop the held item into an empty cell. Anything else
 * changes nothing.
 */
export function pickUp(
  tiles: readonly string[],
  p: Player,
): { tiles: readonly string[]; player: Player } {
  const { cx, cy } = centerCell(p);
  const here = tiles[cy]?.charAt(cx) ?? "";
  if (isItem(here)) {
    const left = p.item === "" ? TILE.empty : p.item;
    return { tiles: setTile(tiles, cx, cy, left), player: { ...p, item: here } };
  }
  if (p.item !== "" && here === TILE.empty) {
    return { tiles: setTile(tiles, cx, cy, p.item), player: { ...p, item: "" } };
  }
  return { tiles, player: p };
}

/**
 * Opens the first door next to the player (see `NEIGHBOURS`) that its key fits, which
 * uses the key up. No key, or no such door: nothing changes.
 */
export function openDoor(
  tiles: readonly string[],
  p: Player,
): { tiles: readonly string[]; player: Player } {
  if (p.item === "") return { tiles, player: p };
  const { cx, cy } = centerCell(p);
  for (const [dx, dy] of NEIGHBOURS) {
    const tile = tiles[cy + dy]?.charAt(cx + dx) ?? "";
    if (isDoor(tile) && DOOR_KEY[tile] === p.item) {
      return { tiles: setTile(tiles, cx + dx, cy + dy, TILE.empty), player: { ...p, item: "" } };
    }
  }
  return { tiles, player: p };
}
