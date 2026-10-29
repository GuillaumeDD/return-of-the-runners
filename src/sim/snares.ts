import { TILE } from "../level/format";
import { centerCell, setTile } from "./gold";
import type { Monk } from "./state";
import { SUB } from "./rules";

/**
 * Snares (S-018 @ 0:22–0:48; S-100). A snare lies in a cell of `tiles` as an item
 * (`s`), picked up into the item slot like the others (`items.ts`). The use key lays it,
 * armed, in the player's cell (`GameState.snares`) if that cell is empty (`.`: not a
 * ladder, a bar, gold or an item), which uses it up. The first monk
 * whose centre enters that cell hangs there for good (`snared`): it no longer moves or
 * catches anyone, and it is not a body, so players and monks pass it. Only death frees
 * it (a bomb, rubble, or a hole refilling on it); the snare goes with it. A monk caught
 * with gold drops it in the snare's cell, or the cell above, whichever is empty (if
 * neither is, it keeps it until it dies). Players walk over armed snares unharmed
 * (provisional).
 */

/** Whether a snare can be laid in cell (cx, cy): an empty cell with no snare armed. */
export function canLaySnare(
  tiles: readonly string[],
  snares: readonly Snare[],
  cx: number,
  cy: number,
): boolean {
  return tiles[cy]?.charAt(cx) === TILE.empty && !snares.some((s) => s.cx === cx && s.cy === cy);
}

/** An armed snare in cell (cx, cy). */
export interface Snare {
  readonly cx: number;
  readonly cy: number;
}

/**
 * A free monk whose centre is on an armed snare: hung there, aligned on its cell, and
 * the snare is used up. Otherwise nothing changes.
 */
export function catchInSnare(
  snares: readonly Snare[],
  tiles: readonly string[],
  m: Monk,
): { snares: readonly Snare[]; tiles: readonly string[]; monk: Monk } {
  if (m.mode !== "free" || m.warp > 0) return { snares, tiles, monk: m };
  const { cx, cy } = centerCell(m);
  const i = snares.findIndex((s) => s.cx === cx && s.cy === cy);
  if (i < 0) return { snares, tiles, monk: m };
  const snared: Monk = {
    ...m,
    mode: "snared",
    x: cx * SUB,
    y: cy * SUB,
    timer: 0,
    holeX: -1,
    holeY: -1,
  };
  const left = snares.filter((_, j) => j !== i);
  if (m.carry <= 0) return { snares: left, tiles, monk: snared };
  const drop = [cy, cy - 1].find((y) => y >= 0 && tiles[y]?.charAt(cx) === TILE.empty);
  if (drop === undefined) return { snares: left, tiles, monk: snared };
  return {
    snares: left,
    tiles: setTile(tiles, cx, drop, TILE.gold),
    monk: { ...snared, carry: 0 },
  };
}
