import { TILE, type Teleport } from "../level/format";
import { overlapsCell } from "./move";
import { cellOf, offsetOf } from "./physics";
import { SUB, TELEPORT_TICKS } from "./rules";
import type { Actor, GameState, Monk } from "./state";

/**
 * Teleporters (S-001, S-025 @ 0:04–0:05): one-way, from an entrance (`T`) to the exit
 * (`t`) it is linked to in the level. An actor aligned on an entrance vanishes and
 * reappears at the linked exit `TELEPORT_TICKS` later. It is moved to the exit at once
 * and waits there in transit (`warp > 0`): not drawn, not moving, and not caught (monks
 * still chase it, toward the exit). A monk on the exit, even one in transit itself,
 * delays the jump until it leaves.
 */

/** The exit an entrance at (cx, cy) leads to, or null. */
export function exitOf(
  teleports: readonly Teleport[],
  cx: number,
  cy: number,
): { cx: number; cy: number } | null {
  const link = teleports.find(([x, y]) => x === cx && y === cy);
  return link === undefined ? null : { cx: link[2], cy: link[3] };
}

/** Whether the actor is in transit through a teleporter. */
export function inTransit(a: Pick<Actor, "warp">): boolean {
  return a.warp > 0;
}

/**
 * The actor after stepping onto an entrance: at the linked exit, in transit. Unchanged
 * when it is not aligned on an entrance, is already in transit, or a monk that is not
 * dead (`monks`: every monk but the actor itself) is on the exit, even partly, in
 * transit included: two monks never come out of an exit on top of each other.
 */
export function tryTeleport<A extends Actor>(
  s: Pick<GameState, "tiles" | "teleports">,
  a: A,
  monks: readonly Monk[],
): A {
  if (inTransit(a) || offsetOf(a.x) !== 0 || offsetOf(a.y) !== 0) return a;
  const cx = cellOf(a.x);
  const cy = cellOf(a.y);
  if (s.tiles[cy]?.charAt(cx) !== TILE.teleportEntrance) return a;
  const exit = exitOf(s.teleports, cx, cy);
  if (exit === null) return a;
  // A snared monk is not a body (`snares.ts`): it does not block the exit.
  const blocked = monks.some(
    (m) => m.mode !== "dead" && m.mode !== "snared" && overlapsCell(m, exit.cx, exit.cy),
  );
  if (blocked) return a;
  return { ...a, x: exit.cx * SUB, y: exit.cy * SUB, warp: TELEPORT_TICKS };
}
