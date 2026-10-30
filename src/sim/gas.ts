import { centerCell } from "./gold";
import { isFalling } from "./move";
import { isBar, isLadder, isPassable, type Terrain } from "./physics";
import { DAZE_TICKS, GAS_CELLS, GAS_TICKS } from "./rules";
import type { Monk } from "./state";

/**
 * The gas gun (S-021 @ 0:53–1:05). It lies in a cell of `tiles` as an item (`g`) and is
 * held in the item slot; it is never used up. The use key fires a cloud into the
 * `GAS_CELLS` cells in front of the player, on its row, stopping at the first solid
 * cell; it stays `GAS_TICKS`. Several clouds can be out at once.
 *
 * A free monk whose centre is in a cloud is `dazed`: it stops where it is (it still
 * falls if nothing holds it up) and catches nobody, and stays so `DAZE_TICKS` after it
 * is in no cloud any more. A monk on a ladder or a bar, or falling, is not affected
 * (S-005). Players pass through clouds unharmed (S-021 @ 0:58–1:00).
 */

/** A cloud over cells `cx` to `cx + width - 1` of row `cy`, for `left` more ticks. */
export interface Cloud {
  readonly cx: number;
  readonly cy: number;
  readonly width: number;
  readonly left: number;
}

/**
 * The cloud fired from cell (cx, cy) toward `facing`: the cells in front, up to the
 * first solid one or the level's edge. Null when the very first is solid or outside.
 */
export function fireGas(t: Terrain, cx: number, cy: number, facing: -1 | 1): Cloud | null {
  let n = 0;
  while (n < GAS_CELLS && isPassable(t, cx + facing * (n + 1), cy)) n++;
  if (n === 0) return null;
  const first = facing === 1 ? cx + 1 : cx - n;
  return { cx: first, cy, width: n, left: GAS_TICKS };
}

export function inCloud(clouds: readonly Cloud[], cx: number, cy: number): boolean {
  return clouds.some((c) => c.cy === cy && cx >= c.cx && cx < c.cx + c.width);
}

/** One tick of the clouds: each one thins, and is gone after `GAS_TICKS`. */
export function stepClouds(clouds: readonly Cloud[]): Cloud[] {
  return clouds.map((c) => ({ ...c, left: c.left - 1 })).filter((c) => c.left > 0);
}

/**
 * Gas on one monk, after it moved: a free or dazed monk in a cloud, not on a ladder or
 * a bar and not falling, is (still) dazed for `DAZE_TICKS`.
 */
export function gasMonk(t: Terrain, clouds: readonly Cloud[], m: Monk): Monk {
  if ((m.mode !== "free" && m.mode !== "dazed") || m.warp > 0) return m;
  const { cx, cy } = centerCell(m);
  if (!inCloud(clouds, cx, cy)) return m;
  if (isLadder(t, cx, cy) || isBar(t, cx, cy) || isFalling(t, m)) return m;
  return { ...m, mode: "dazed", timer: DAZE_TICKS };
}
