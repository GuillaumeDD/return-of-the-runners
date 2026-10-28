import { TILE } from "../level/format";
import { chooseMove, type ChaseView, type MonkMove } from "./ai";
import { centerCell, setTile, takeGold } from "./gold";
import { holeAt, isDugOut, type Hole } from "./holes";
import { NO_INPUT, type PlayerInput } from "./input";
import { every, isFalling, overlapsCell, stepActor, tryHorizontal } from "./move";
import { cellOf, isPassable, isSolid, offsetOf, type Terrain } from "./physics";
import { prngInt } from "./prng";
import { MONK_CARRY, MONK_PERIOD, MONK_TICKS, SUB } from "./rules";
import type { Actor, Facing, GameState, Monk } from "./state";

/** What the monks change in one tick. */
export interface MonksResult {
  readonly monks: readonly Monk[];
  readonly tiles: readonly string[];
  readonly rng: number;
  /** A monk touched the runner. */
  readonly caught: boolean;
}

const INPUT: Readonly<Record<MonkMove, PlayerInput>> = {
  left: { ...NO_INPUT, left: true },
  right: { ...NO_INPUT, right: true },
  up: { ...NO_INPUT, up: true },
  down: { ...NO_INPUT, down: true },
  none: NO_INPUT,
};

/** Two tile-sized boxes overlap (monks never do). */
function overlaps(a: Pick<Actor, "x" | "y">, b: Pick<Actor, "x" | "y">): boolean {
  return Math.abs(a.x - b.x) < SUB && Math.abs(a.y - b.y) < SUB;
}

function sameCell(a: Actor, b: Actor): boolean {
  const ca = centerCell(a);
  const cb = centerCell(b);
  return ca.cx === cb.cx && ca.cy === cb.cy;
}

function aligned(a: Actor): boolean {
  return offsetOf(a.x) === 0 && offsetOf(a.y) === 0;
}

/** Free floor for gold: an empty tile (not dug) with brick, bedrock or a ladder below. */
function canHoldGold(t: Terrain, cx: number, cy: number): boolean {
  if (t.tiles[cy]?.charAt(cx) !== TILE.empty || holeAt(t.holes, cx, cy) !== undefined) {
    return false;
  }
  if (cy + 1 >= t.height) return true;
  const below = t.tiles[cy + 1]?.charAt(cx) ?? TILE.bedrock;
  return isSolid(below) || below === TILE.ladder;
}

/**
 * Advances every monk by one tick, in order; each sees the monks before it already
 * moved. Runs after the runner has moved and collected gold.
 */
export function stepMonks(state: GameState, tick: number): MonksResult {
  const monks = [...state.monks];
  let tiles = state.tiles;
  let rng = state.rng;
  let caught = false;
  const runnerCell = centerCell(state.runner);
  const runnerFalling = isFalling(state, state.runner);

  for (let i = 0; i < monks.length; i++) {
    const before = monks[i];
    if (before === undefined) continue;
    const others = monks.filter((_, j) => j !== i);
    const t: Terrain = { ...state, tiles, monks: others };
    let m: Monk = before;

    switch (m.mode) {
      case "dead": {
        if (m.timer > 1) {
          m = { ...m, timer: m.timer - 1 };
          break;
        }
        const spot = respawnCell(t, state.runner, rng);
        rng = spot.rng;
        m =
          spot.cell === null
            ? { ...m, timer: MONK_TICKS.respawn }
            : { ...m, x: spot.cell.cx * SUB, y: spot.cell.cy * SUB, mode: "free", timer: 0 };
        break;
      }
      case "trapped":
        m = m.timer > 1 ? { ...m, timer: m.timer - 1 } : { ...m, mode: "escaping", timer: 0 };
        break;
      case "escaping":
        m = escape(t, m, view(m), tick, state.runner);
        break;
      case "free": {
        const move = chooseMove(t, view(m));
        const moved = stepActor(t, m, INPUT[move], tick, MONK_PERIOD);
        m = { ...m, ...moved };
        break;
      }
    }

    // Monks never overlap: a move into another monk is cancelled, mode change included.
    if (m.mode !== "dead" && (m.x !== before.x || m.y !== before.y)) {
      if (others.some((o) => o.mode !== "dead" && overlaps(m, o))) m = before;
    }

    if (m.mode === "free" || m.mode === "escaping") {
      const carried = carryGold(t, before, m, tiles, rng);
      m = carried.monk;
      tiles = carried.tiles;
      rng = carried.rng;
    }

    if (m.mode === "free" && aligned(m)) {
      const { cx, cy } = centerCell(m);
      if (isDugOut(state.holes, cx, cy)) {
        const trapped = trap(m, cx, cy, tiles);
        m = trapped.monk;
        tiles = trapped.tiles;
      }
    }

    if (m.mode !== "dead" && sameCell(m, state.runner)) caught = true;
    monks[i] = m;
  }

  return { monks, tiles, rng, caught };

  function view(m: Monk): ChaseView {
    const { cx, cy } = centerCell(m);
    return {
      cx,
      cy,
      x: m.x,
      rx: runnerCell.cx,
      ry: runnerCell.cy,
      runnerX: state.runner.x,
      runnerFalling,
    };
  }
}

/**
 * Climbing out of a hole: straight up to the row above it, then sideways in the
 * direction the AI picks (or the way the monk faces). Above the hole it does not fall
 * back in, until it has left the hole's column. Walled in on both sides, it gives up
 * and falls back in. A runner standing on the hole holds it down: it cannot climb
 * while the runner is in the cell above (S-100).
 */
function escape(t: Terrain, m: Monk, v: ChaseView, tick: number, runner: Actor): Monk {
  const topY = (m.holeY - 1) * SUB;
  if (m.y > topY) {
    if (!isPassable(t, m.holeX, m.holeY - 1)) return m;
    if (overlapsCell(runner, m.holeX, m.holeY - 1)) return m;
    return every(tick, MONK_PERIOD.climb) ? { ...m, y: m.y - 1 } : m;
  }
  const top = m.holeY - 1;
  if (!isPassable(t, m.holeX - 1, top) && !isPassable(t, m.holeX + 1, top)) {
    return { ...m, mode: "free", holeX: -1, holeY: -1 };
  }
  const move = chooseMove(t, v);
  const dir: Facing = move === "left" ? -1 : move === "right" ? 1 : m.facing;
  const moved = tryHorizontal(t, m, dir, tick, MONK_PERIOD) ?? m;
  const out = cellOf(moved.x + SUB / 2) !== m.holeX;
  return out ? { ...m, ...moved, mode: "free", holeX: -1, holeY: -1 } : { ...m, ...moved };
}

/**
 * Falls into a hole: trapped, and drops its gold on top of the hole if there is room.
 * It then waits two cells before taking gold again, so it does not pick the same gold
 * back up while climbing out through it.
 */
function trap(
  m: Monk,
  cx: number,
  cy: number,
  tiles: readonly string[],
): { monk: Monk; tiles: readonly string[] } {
  const monk: Monk = { ...m, mode: "trapped", timer: MONK_TICKS.trapped, holeX: cx, holeY: cy };
  if (m.carry > 0 && cy > 0 && tiles[cy - 1]?.charAt(cx) === TILE.empty) {
    return { monk: { ...monk, carry: -2 }, tiles: setTile(tiles, cx, cy - 1, TILE.gold) };
  }
  return { monk, tiles };
}

/**
 * Gold carrying (1982 rules): on each arrival in a new cell the carry count goes down,
 * and at 1 the gold is dropped on the first free floor cell; a monk with nothing picks
 * up the gold it touches.
 */
function carryGold(
  t: Terrain,
  before: Monk,
  m: Monk,
  tiles: readonly string[],
  rng: number,
): { monk: Monk; tiles: readonly string[]; rng: number } {
  let monk = m;
  let out = tiles;
  const { cx, cy } = centerCell(m);
  const arrived = aligned(m) && (m.x !== before.x || m.y !== before.y);
  if (arrived) {
    if (monk.carry > 1) monk = { ...monk, carry: monk.carry - 1 };
    else if (monk.carry === 1 && canHoldGold({ ...t, tiles: out }, cx, cy)) {
      out = setTile(out, cx, cy, TILE.gold);
      monk = { ...monk, carry: -1 };
    } else if (monk.carry < 0) monk = { ...monk, carry: monk.carry + 1 };
  }
  if (monk.carry === 0) {
    const taken = takeGold(out, cx, cy);
    if (taken !== null) {
      const n = prngInt(rng, MONK_CARRY.spread);
      return { monk: { ...monk, carry: MONK_CARRY.min + n.value }, tiles: taken, rng: n.state };
    }
  }
  return { monk, tiles: out, rng };
}

/**
 * Where a dead monk reappears (1982 rule): on the second row, from a random column
 * onward (wrapping), the first empty cell; if the row is full, the next row down.
 */
export function respawnCell(
  t: Terrain,
  runner: Actor,
  rng: number,
): { cell: { cx: number; cy: number } | null; rng: number } {
  const start = prngInt(rng, t.width);
  const runnerCell = centerCell(runner);
  const holes: readonly Hole[] = t.holes;
  for (let cy = Math.min(1, t.height - 1); cy < t.height; cy++) {
    for (let i = 0; i < t.width; i++) {
      const cx = (start.value + i) % t.width;
      const free =
        t.tiles[cy]?.charAt(cx) === TILE.empty &&
        holeAt(holes, cx, cy) === undefined &&
        !t.monks.some((o) => o.mode !== "dead" && overlaps(o, { x: cx * SUB, y: cy * SUB })) &&
        !(runnerCell.cx === cx && runnerCell.cy === cy);
      if (free) return { cell: { cx, cy }, rng: start.state };
    }
  }
  return { cell: null, rng: start.state };
}
