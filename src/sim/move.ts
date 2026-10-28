import type { PlayerInput } from "./input";
import {
  cellOf,
  isBar,
  isLadder,
  isPassable,
  isSupported,
  offsetOf,
  onGoo,
  type Terrain,
} from "./physics";
import { GOO_PERIOD, SUB, type Period } from "./rules";
import type { Actor, Facing } from "./state";

/**
 * Movement shared by the runner and the monks: the same rules, at each actor's own
 * speed (`Period`). Pure functions of the terrain, the actor, its intent and the tick.
 */

/** Whether the actor is falling: aligned on x and not held up. */
export function isFalling(t: Terrain, a: Actor): boolean {
  if (offsetOf(a.x) !== 0) return false;
  const cx = cellOf(a.x);
  const cy = cellOf(a.y);
  if (offsetOf(a.y) === 0) return !isSupported(t, cx, cy);
  // Between two rows: climbing if a ladder spans the gap, otherwise falling.
  return !isLadder(t, cx, cy) && !isLadder(t, cx, cy + 1);
}

/** Whether any part of the actor's tile-sized box is inside cell (cx, cy). */
export function overlapsCell(a: Actor, cx: number, cy: number): boolean {
  return (
    cellOf(a.x) <= cx &&
    cx <= cellOf(a.x + SUB - 1) &&
    cellOf(a.y) <= cy &&
    cy <= cellOf(a.y + SUB - 1)
  );
}

/** Opposite directions cancel out. */
function axis(negative: boolean, positive: boolean): -1 | 0 | 1 {
  if (negative === positive) return 0;
  return positive ? 1 : -1;
}

export function every(tick: number, period: number): boolean {
  return tick % period === 0;
}

/** One tick of movement: falls if unsupported, otherwise follows the input. */
export function stepActor(
  t: Terrain,
  a: Actor,
  input: PlayerInput,
  tick: number,
  period: Period,
): Actor {
  if (isFalling(t, a)) {
    return every(tick, period.fall) ? { ...a, y: a.y + 1 } : a;
  }

  const h = axis(input.left, input.right);
  const v = axis(input.up, input.down);

  // Vertical intent wins when it can actually move; otherwise fall back to horizontal.
  if (v !== 0) {
    const moved = tryVertical(t, a, v, tick, period);
    if (moved !== null) return moved;
  }
  if (h !== 0) {
    const moved = tryHorizontal(t, a, h, tick, period);
    if (moved !== null) return moved;
  }
  return a;
}

/** Moves toward the nearest aligned position on one axis (used before turning). */
function snap(pos: number): number {
  const off = offsetOf(pos);
  return off < SUB / 2 ? pos - 1 : pos + 1;
}

function tryVertical(
  t: Terrain,
  a: Actor,
  dir: -1 | 1,
  tick: number,
  period: Period,
): Actor | null {
  const cx = cellOf(a.x);
  const cy = cellOf(a.y);

  if (offsetOf(a.x) !== 0) {
    // Not aligned on x: snap toward the nearest column if a ladder is there, or, going
    // down, to let go of the bar the actor hangs from (it drops once aligned).
    const near = offsetOf(a.x) < SUB / 2 ? cx : cx + 1;
    const ladderNear = isLadder(t, near, cy) || (dir === 1 && isLadder(t, near, cy + 1));
    const letGo =
      dir === 1 &&
      offsetOf(a.y) === 0 &&
      (isBar(t, cx, cy) || isBar(t, cx + 1, cy)) &&
      isPassable(t, near, cy + 1);
    if (!ladderNear && !letGo) return null;
    return every(tick, period.walk) ? { ...a, x: snap(a.x) } : a;
  }

  if (offsetOf(a.y) !== 0) {
    // Mid-climb between two rows (isFalling() ruled out the no-ladder case).
    return every(tick, period.climb) ? { ...a, y: a.y + dir } : a;
  }

  if (dir === -1) {
    if (!isLadder(t, cx, cy) || !isPassable(t, cx, cy - 1)) return null;
  } else {
    if (!isPassable(t, cx, cy + 1)) return null;
    // Down is allowed onto a ladder, along a ladder, or to let go of a bar.
    const canGoDown = isLadder(t, cx, cy + 1) || isLadder(t, cx, cy) || isBar(t, cx, cy);
    if (!canGoDown) return null;
  }
  return every(tick, period.climb) ? { ...a, y: a.y + dir } : a;
}

/** Horizontal step; also used on its own by a monk walking off the top of its hole. */
export function tryHorizontal(
  t: Terrain,
  a: Actor,
  dir: Facing,
  tick: number,
  period: Period,
): Actor | null {
  const cy = cellOf(a.y);
  const facing = dir;

  if (offsetOf(a.y) !== 0) {
    // On a ladder between rows: snap to the nearest row before stepping off.
    return every(tick, period.climb) ? { ...a, y: snap(a.y), facing } : { ...a, facing };
  }

  if (offsetOf(a.x) === 0) {
    const cx = cellOf(a.x);
    if (!isPassable(t, cx + dir, cy)) return { ...a, facing };
  }
  // Mid-tile: both neighbouring cells were checked when the move began, so the actor
  // may continue or reverse freely. Gooey turf slows runners and monks alike.
  const p = isBar(t, cellOf(a.x), cy) ? period.bar : onGoo(t, a) ? GOO_PERIOD : period.walk;
  return every(tick, p) ? { ...a, x: a.x + dir, facing } : { ...a, facing };
}
