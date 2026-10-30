import { TILE } from "../level/format";
import { chooseMove, type ChaseView, type MonkMove } from "./ai";
import { centerCell, setTile, takeGold } from "./gold";
import { craterAt, holeAt, isDugOut, type Hole } from "./holes";
import { NO_INPUT, type PlayerInput } from "./input";
import { every, isFalling, overlapsCell, stepActor, tryHorizontal } from "./move";
import { cellOf, isBar, isLadder, isPassable, isSolid, offsetOf, type Terrain } from "./physics";
import { prngInt } from "./prng";
import { gasMonk } from "./gas";
import { catchInSnare, type Snare } from "./snares";
import { inTransit, tryTeleport } from "./teleport";
import { rubbleAt, rubbleIn } from "./tools";
import { MONK_CARRY, MONK_PERIOD, MONK_TICKS, SUB } from "./rules";
import type { Actor, Facing, GameState, Monk, Player } from "./state";

/** What the monks change in one tick. */
export interface MonksResult {
  readonly monks: readonly Monk[];
  readonly tiles: readonly string[];
  readonly rng: number;
  /** `caught[i]`: a monk touched player i. */
  readonly caught: readonly boolean[];
  /** The snares still armed (a monk walking into one uses it up). */
  readonly snares: readonly Snare[];
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

/**
 * A player hiding in an alcove (its centre in the cell): monks neither see it nor catch
 * it (S-018 @ 0:02–0:19, S-100). Seeing: provisional (see ARCHITECTURE).
 */
export function isHidden(tiles: readonly string[], p: Actor): boolean {
  const { cx, cy } = centerCell(p);
  return tiles[cy]?.charAt(cx) === TILE.alcove;
}

/**
 * Whether monks can see a player: in play and not hiding in an alcove. A player in
 * transit through a teleporter is seen where it will appear (at the exit), but cannot
 * be caught until it does.
 */
export function inSight(tiles: readonly string[], p: Player): boolean {
  return p.mode === "alive" && !isHidden(tiles, p);
}

function aligned(a: Actor): boolean {
  return offsetOf(a.x) === 0 && offsetOf(a.y) === 0;
}

/**
 * Free floor for gold: an empty tile (not dug, no rubble) with a solid tile, a ladder or
 * landed rubble below; not over a crater (`bombs.ts`).
 */
function canHoldGold(t: Terrain, cx: number, cy: number): boolean {
  const here = t.tiles[cy]?.charAt(cx);
  if (here !== TILE.empty || holeAt(t.holes, cx, cy) !== undefined || rubbleIn(t.rubble, cx, cy)) {
    return false;
  }
  if (cy + 1 >= t.height || rubbleAt(t.rubble, cx, cy + 1)) return true;
  if (craterAt(t.craters, cx, cy + 1) !== undefined) return false;
  const below = t.tiles[cy + 1]?.charAt(cx) ?? TILE.bedrock;
  return isSolid(below) || below === TILE.ladder;
}

/**
 * The player a monk chases: the nearest one in play, by the distance between their
 * positions (|dx| + |dy|, in sub-units); a tie goes to the lower index (player 1).
 * Null when no player is in play. (Callers pass the players in sight, see `view`.)
 */
export function targetOf(m: Pick<Actor, "x" | "y">, players: readonly Player[]): Player | null {
  let best: Player | null = null;
  let bestDistance = Infinity;
  for (const p of players) {
    if (p.mode !== "alive") continue;
    const d = Math.abs(p.x - m.x) + Math.abs(p.y - m.y);
    if (d < bestDistance) {
      best = p;
      bestDistance = d;
    }
  }
  return best;
}

/**
 * Advances every monk by one tick, in order; each sees the monks before it already
 * moved. Runs after the players have moved and collected gold.
 */
export function stepMonks(state: GameState, tick: number): MonksResult {
  const monks = [...state.monks];
  let tiles = state.tiles;
  let rng = state.rng;
  let snares = state.snares;
  const caught = state.players.map(() => false);

  for (let i = 0; i < monks.length; i++) {
    const before = monks[i];
    if (before === undefined) continue;
    const others = monks.filter((_, j) => j !== i);
    const t: Terrain = { ...state, tiles, monks: others };
    let m: Monk = before;
    // In a teleporter: waits at the exit until it appears.
    if (inTransit(m)) {
      monks[i] = { ...m, warp: m.warp - 1 };
      continue;
    }

    switch (m.mode) {
      case "dead": {
        if (m.timer > 1) {
          m = { ...m, timer: m.timer - 1 };
          break;
        }
        const spot = respawnCell(t, state.players, rng);
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
        m = escape(t, m, view(state, m), tick, state.players);
        break;
      case "snared":
        break;
      case "dazed": {
        // Stands still (it still falls if unsupported) until the daze wears off.
        const moved = stepActor(t, m, NO_INPUT, tick, MONK_PERIOD);
        m =
          m.timer > 1
            ? { ...m, ...moved, timer: m.timer - 1 }
            : { ...m, ...moved, mode: "free", timer: 0 };
        break;
      }
      case "free": {
        // No player in play and in sight: the monk waits (it still falls if unsupported).
        const v = view(state, m);
        const move = v === null ? "none" : chooseMove(t, v);
        const moved = stepActor(t, m, INPUT[toColumn(t, m, move)], tick, MONK_PERIOD);
        m = { ...m, ...moved };
        break;
      }
    }

    // Monks never overlap: a move into another monk is cancelled, mode change included.
    if (m.mode !== "dead" && (m.x !== before.x || m.y !== before.y)) {
      // A monk in transit counts: it is already on its exit.
      // A snared monk is not a body: monks pass it.
      if (others.some((o) => o.mode !== "dead" && o.mode !== "snared" && overlaps(m, o))) {
        m = before;
      }
    }

    if (m.mode === "free" || m.mode === "escaping") {
      const carried = carryGold(t, before, m, tiles, rng);
      m = carried.monk;
      tiles = carried.tiles;
      rng = carried.rng;
    }

    ({ snares, tiles, monk: m } = catchInSnare(snares, tiles, m));
    // A dazed monk that falls into a hole is trapped there like a free one.
    if ((m.mode === "free" || m.mode === "dazed") && aligned(m)) {
      const { cx, cy } = centerCell(m);
      if (isDugOut(state.holes, cx, cy)) {
        const trapped = trap(m, cx, cy, tiles);
        m = trapped.monk;
        tiles = trapped.tiles;
      }
    }
    if (m.mode === "free") m = tryTeleport({ ...state, tiles }, m, others);
    m = gasMonk({ ...t, tiles }, state.clouds, m);

    // Snared and dazed monks catch nobody.
    if ((m.mode === "free" || m.mode === "trapped" || m.mode === "escaping") && !inTransit(m)) {
      state.players.forEach((p, j) => {
        if (inSight(tiles, p) && !inTransit(p) && sameCell(m, p)) caught[j] = true;
      });
    }
    monks[i] = m;
  }

  return { monks, tiles, rng, caught, snares };
}

/**
 * The AI picks "down" from the monk's centre column. Without a ladder or bar there, the
 * runner's rules would not move a monk off the column's grid line (it would stand at
 * the edge of a pit forever): it walks to the column instead, and falls once there.
 */
function toColumn(t: Terrain, m: Monk, move: MonkMove): MonkMove {
  if (move !== "down" || offsetOf(m.x) === 0 || offsetOf(m.y) !== 0) return move;
  const { cx, cy } = centerCell(m);
  if (isLadder(t, cx, cy) || isLadder(t, cx, cy + 1) || isBar(t, cx, cy)) return move;
  if (isBar(t, cellOf(m.x), cy)) return move;
  return cx * SUB > m.x ? "right" : "left";
}

/**
 * What the chase AI sees of a monk and the player it chases; null without a player in
 * sight (players hiding in an alcove are not).
 * Whether that player falls is judged on the state at the start of the tick, so it
 * does not depend on which monks moved before this one.
 */
function view(state: GameState, m: Monk): ChaseView | null {
  const target = targetOf(
    m,
    state.players.filter((p) => inSight(state.tiles, p)),
  );
  if (target === null) return null;
  const { cx, cy } = centerCell(m);
  const r = centerCell(target);
  return {
    cx,
    cy,
    x: m.x,
    rx: r.cx,
    ry: r.cy,
    runnerX: target.x,
    runnerFalling: isFalling(state, target),
  };
}

/**
 * Climbing out of a hole: straight up to the row above it, then sideways in the
 * direction the AI picks (or the way the monk faces, when it picks none or no player is
 * in play and in sight). Above the hole it does not fall
 * back in, until it has left the hole's column. Walled in on both sides, it gives up
 * and falls back in. A player standing on the hole holds it down: it cannot climb
 * while a player in play is in the cell above (S-100).
 */
function escape(
  t: Terrain,
  m: Monk,
  v: ChaseView | null,
  tick: number,
  players: readonly Player[],
): Monk {
  const topY = (m.holeY - 1) * SUB;
  if (m.y > topY) {
    if (!isPassable(t, m.holeX, m.holeY - 1)) return m;
    if (
      players.some(
        (p) => p.mode === "alive" && !inTransit(p) && overlapsCell(p, m.holeX, m.holeY - 1),
      )
    ) {
      return m;
    }
    return every(tick, MONK_PERIOD.climb) ? { ...m, y: m.y - 1 } : m;
  }
  const top = m.holeY - 1;
  if (!isPassable(t, m.holeX - 1, top) && !isPassable(t, m.holeX + 1, top)) {
    return { ...m, mode: "free", holeX: -1, holeY: -1 };
  }
  const move = v === null ? "none" : chooseMove(t, v);
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
 * Where a dead monk reappears. A level with monk respawn points (`R`) uses one of them,
 * drawn from the PRNG among those free of monks, of players in play and of rubble; with
 * all taken, none (the monk waits). Without any, the 1982 rule: on the second row, from
 * a random column onward (wrapping), the first empty cell free of monks, of players in
 * play and of rubble; if the row is full, the next row down.
 */
export function respawnCell(
  t: Terrain,
  players: readonly Player[],
  rng: number,
): { cell: { cx: number; cy: number } | null; rng: number } {
  const playerCells = players.filter((p) => p.mode === "alive").map(centerCell);
  const taken = (cx: number, cy: number): boolean =>
    t.monks.some((o) => o.mode !== "dead" && overlaps(o, { x: cx * SUB, y: cy * SUB })) ||
    playerCells.some((c) => c.cx === cx && c.cy === cy) ||
    rubbleIn(t.rubble, cx, cy);
  const points: { cx: number; cy: number }[] = [];
  t.tiles.forEach((row, cy) => {
    for (let cx = 0; cx < row.length; cx++) {
      if (row.charAt(cx) === TILE.monkRespawn) points.push({ cx, cy });
    }
  });
  if (points.length > 0) {
    const free = points.filter((c) => !taken(c.cx, c.cy));
    if (free.length === 0) return { cell: null, rng };
    const pick = prngInt(rng, free.length);
    return { cell: free[pick.value] ?? null, rng: pick.state };
  }
  const start = prngInt(rng, t.width);
  const holes: readonly Hole[] = t.holes;
  for (let cy = Math.min(1, t.height - 1); cy < t.height; cy++) {
    for (let i = 0; i < t.width; i++) {
      const cx = (start.value + i) % t.width;
      const free =
        t.tiles[cy]?.charAt(cx) === TILE.empty &&
        holeAt(holes, cx, cy) === undefined &&
        !taken(cx, cy);
      if (free) return { cell: { cx, cy }, rng: start.state };
    }
  }
  return { cell: null, rng: start.state };
}
