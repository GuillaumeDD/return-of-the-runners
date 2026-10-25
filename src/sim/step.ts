import { TILE } from "../level/format";
import { HOLE_LIFETIME, holeAt, type Hole } from "./holes";
import type { PlayerInput } from "./input";
import {
  cellOf,
  isBar,
  isLadder,
  isPassable,
  isSupported,
  offsetOf,
  tileAt,
  type Terrain,
} from "./physics";
import { HOLE_TICKS, RUNNER_PERIOD, SUB } from "./rules";
import type { Actor, Facing, GameState } from "./state";

/**
 * Advances the game by one tick. Pure: returns a new state.
 *
 * Order within a tick: the runner acts (dig or move) on the current terrain, then holes
 * age, then a runner inside a hole that just filled dies.
 */
export function step(state: GameState, input: PlayerInput): GameState {
  const tick = state.tick + 1;
  if (state.status !== "playing") return { ...state, tick };

  let runner = state.runner;
  let holes = state.holes;
  if (runner.busy > 0) {
    runner = { ...runner, busy: runner.busy - 1 };
  } else {
    const dig = tryDig(state, runner, input);
    if (dig !== null) {
      runner = dig.runner;
      holes = [...holes, dig.hole];
    } else {
      runner = stepActor(state, runner, input, tick);
    }
  }

  const aged = holes.map((h) => ({ ...h, age: h.age + 1 }));
  const filled = aged.filter((h) => h.age >= HOLE_LIFETIME);
  const status = filled.some((h) => overlapsCell(runner, h.cx, h.cy)) ? "dead" : "playing";
  return {
    ...state,
    tick,
    runner,
    holes: aged.filter((h) => h.age < HOLE_LIFETIME),
    status,
  };
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

/**
 * Digs the brick diagonally below on the given side. Requires the runner to stand
 * aligned on solid ground (not falling, not on a ladder or bar: provisional, see
 * ARCHITECTURE), the target to be an undug brick, and the cell above it to be empty.
 */
function tryDig(t: Terrain, a: Actor, input: PlayerInput): { runner: Actor; hole: Hole } | null {
  if (input.digLeft === input.digRight) return null;
  const dir: Facing = input.digLeft ? -1 : 1;
  if (offsetOf(a.x) !== 0 || offsetOf(a.y) !== 0 || isFalling(t, a)) return null;
  const cx = cellOf(a.x);
  const cy = cellOf(a.y);
  if (isLadder(t, cx, cy) || isBar(t, cx, cy)) return null;
  const tx = cx + dir;
  const ty = cy + 1;
  if (tileAt(t, tx, ty) !== TILE.brick || holeAt(t.holes, tx, ty) !== undefined) return null;
  if (tileAt(t, tx, cy) !== TILE.empty) return null;
  return {
    runner: { ...a, facing: dir, busy: HOLE_TICKS.digging },
    hole: { cx: tx, cy: ty, age: 0 },
  };
}

/** Whether the actor is falling: aligned on x and not held up. */
export function isFalling(t: Terrain, a: Actor): boolean {
  if (offsetOf(a.x) !== 0) return false;
  const cx = cellOf(a.x);
  const cy = cellOf(a.y);
  if (offsetOf(a.y) === 0) return !isSupported(t, cx, cy);
  // Between two rows: climbing if a ladder spans the gap, otherwise falling.
  return !isLadder(t, cx, cy) && !isLadder(t, cx, cy + 1);
}

/** Opposite directions cancel out. */
function axis(negative: boolean, positive: boolean): -1 | 0 | 1 {
  if (negative === positive) return 0;
  return positive ? 1 : -1;
}

function every(tick: number, period: number): boolean {
  return tick % period === 0;
}

function stepActor(t: Terrain, a: Actor, input: PlayerInput, tick: number): Actor {
  if (isFalling(t, a)) {
    return every(tick, RUNNER_PERIOD.fall) ? { ...a, y: a.y + 1 } : a;
  }

  const h = axis(input.left, input.right);
  const v = axis(input.up, input.down);

  // Vertical intent wins when it can actually move; otherwise fall back to horizontal.
  if (v !== 0) {
    const moved = tryVertical(t, a, v, tick);
    if (moved !== null) return moved;
  }
  if (h !== 0) {
    const moved = tryHorizontal(t, a, h, tick);
    if (moved !== null) return moved;
  }
  return a;
}

/** Moves toward the nearest aligned position on one axis (used before turning). */
function snap(pos: number): number {
  const off = offsetOf(pos);
  return off < SUB / 2 ? pos - 1 : pos + 1;
}

function tryVertical(t: Terrain, a: Actor, dir: -1 | 1, tick: number): Actor | null {
  const cx = cellOf(a.x);
  const cy = cellOf(a.y);

  if (offsetOf(a.x) !== 0) {
    // Not aligned on x: only a ladder can be turned onto, so snap toward the ladder column.
    const near = offsetOf(a.x) < SUB / 2 ? cx : cx + 1;
    const ladderNear = isLadder(t, near, cy) || (dir === 1 && isLadder(t, near, cy + 1));
    if (!ladderNear) return null;
    return every(tick, RUNNER_PERIOD.walk) ? { ...a, x: snap(a.x) } : a;
  }

  if (offsetOf(a.y) !== 0) {
    // Mid-climb between two rows (isFalling() ruled out the no-ladder case).
    return every(tick, RUNNER_PERIOD.climb) ? { ...a, y: a.y + dir } : a;
  }

  if (dir === -1) {
    if (!isLadder(t, cx, cy) || !isPassable(t, cx, cy - 1)) return null;
  } else {
    if (!isPassable(t, cx, cy + 1)) return null;
    // Down is allowed onto a ladder, along a ladder, or to let go of a bar.
    const canGoDown = isLadder(t, cx, cy + 1) || isLadder(t, cx, cy) || isBar(t, cx, cy);
    if (!canGoDown) return null;
  }
  return every(tick, RUNNER_PERIOD.climb) ? { ...a, y: a.y + dir } : a;
}

function tryHorizontal(t: Terrain, a: Actor, dir: Facing, tick: number): Actor | null {
  const cy = cellOf(a.y);
  const facing = dir;

  if (offsetOf(a.y) !== 0) {
    // On a ladder between rows: snap to the nearest row before stepping off.
    return every(tick, RUNNER_PERIOD.climb) ? { ...a, y: snap(a.y), facing } : { ...a, facing };
  }

  if (offsetOf(a.x) === 0) {
    const cx = cellOf(a.x);
    if (!isPassable(t, cx + dir, cy)) return { ...a, facing };
  }
  // Mid-tile: both neighbouring cells were checked when the move began, so the actor
  // may continue or reverse freely.
  const period = isBar(t, cellOf(a.x), cy) ? RUNNER_PERIOD.bar : RUNNER_PERIOD.walk;
  return every(tick, period) ? { ...a, x: a.x + dir, facing } : { ...a, facing };
}
