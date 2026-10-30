import { TILE } from "../level/format";
import { setTile } from "./gold";
import { holeAt } from "./holes";
import { isBar, isPassable, tileAt, type Terrain } from "./physics";
import { GOO_CELLS } from "./rules";

/**
 * The goo bucket (S-022 @ 3:16–3:36). It lies in a cell of `tiles` as an item (`u`) and
 * is held in the item slot. The use key throws its goo along the floor in front of the
 * player: the floor under each of the next `GOO_CELLS` cells on its row becomes gooey
 * turf (`~`) for the rest of the level, and the bucket is used up. Gooey turf slows
 * runners and monks alike (`GOO_PERIOD`), which is how a monk "gets stuck" in it
 * (S-022 @ 3:19–3:36). The covered floor is gooey turf from then on: it cannot be dug,
 * cratered by a small bomb or drilled, and a big blast destroys it (provisional).
 *
 * The goo runs from the cell next to the player outward and stops at the first cell an
 * actor cannot stand in (a wall, the level's edge), or whose floor is not intact brick,
 * bedrock or goo (a gap, a ladder, a hole even while it is dug, a crater, rubble, a
 * door). The player must not hang on a bar. The bucket is kept when not even the first
 * cell can take goo.
 */

/** Floor tiles goo can cover (gooey turf stays gooey turf). */
const GOO_FLOORS: ReadonlySet<string> = new Set([TILE.brick, TILE.bedrock, TILE.gooeyTurf]);

/** Whether the floor under (cx, cy) can take goo: intact brick, bedrock or goo. */
function gooFloor(t: Terrain, cx: number, cy: number): boolean {
  const raw = t.tiles[cy + 1]?.charAt(cx) ?? "";
  // A brick being dug is still solid but already a hole. `tileAt` reads an opened
  // brick (hole or crater) as empty and landed rubble as bedrock: both differ from the
  // raw tile.
  if (holeAt(t.holes, cx, cy + 1) !== undefined) return false;
  return GOO_FLOORS.has(raw) && tileAt(t, cx, cy + 1) === raw;
}

/**
 * The tiles after a throw from cell (cx, cy) toward `facing`, or null when not even the
 * first cell in front can take goo.
 */
export function throwGoo(
  t: Terrain,
  cx: number,
  cy: number,
  facing: -1 | 1,
): readonly string[] | null {
  if (isBar(t, cx, cy)) return null;
  let tiles = t.tiles;
  let n = 0;
  while (n < GOO_CELLS) {
    const x = cx + facing * (n + 1);
    if (!isPassable(t, x, cy) || !gooFloor(t, x, cy)) break;
    tiles = setTile(tiles, x, cy + 1, TILE.gooeyTurf);
    n++;
  }
  return n === 0 ? null : tiles;
}
