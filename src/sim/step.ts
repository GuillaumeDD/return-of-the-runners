import { TILE } from "../level/format";
import { centerCell, takeGold } from "./gold";
import { HOLE_LIFETIME, holeAt, type Hole } from "./holes";
import type { PlayerInput } from "./input";
import { stepMonks } from "./monks";
import { isFalling, overlapsCell, stepActor } from "./move";
import { cellOf, monkAt, tileAt, type Terrain } from "./physics";
import { HOLE_TICKS, MONK_TICKS, RUNNER_PERIOD, SUB } from "./rules";
import type { Actor, Facing, GameState } from "./state";

/**
 * Advances the game by one tick. Pure: returns a new state.
 *
 * Order within a tick: the runner acts (dig or move) on the current terrain, picks up
 * the gold it touches and wins if it touches the open exit. Unless it won, the monks then
 * act in order, and a monk touching the runner catches it. Then holes age: a runner or
 * monk inside a hole that just filled dies.
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
      runner = stepActor(state, runner, input, tick, RUNNER_PERIOD);
    }
  }

  const { cx, cy } = centerCell(runner);
  let tiles = state.tiles;
  let goldLeft = state.goldLeft;
  const taken = takeGold(tiles, cx, cy);
  if (taken !== null) {
    tiles = taken;
    goldLeft -= 1;
  }
  const won = goldLeft === 0 && tiles[cy]?.charAt(cx) === TILE.exit;

  let monks = state.monks;
  let rng = state.rng;
  let caught = false;
  if (!won) {
    const after = stepMonks({ ...state, tiles, goldLeft, runner, holes }, tick);
    ({ monks, tiles, rng, caught } = after);
  }

  const aged = holes.map((h) => ({ ...h, age: h.age + 1 }));
  const filled = aged.filter((h) => h.age >= HOLE_LIFETIME);
  const buried = (a: Actor): boolean => filled.some((h) => overlapsCell(a, h.cx, h.cy));
  monks = monks.map((m) =>
    m.mode !== "dead" && buried(m)
      ? { ...m, mode: "dead", timer: MONK_TICKS.respawn, holeX: -1, holeY: -1 }
      : m,
  );
  const dead = caught || buried(runner);
  return {
    ...state,
    tick,
    rng,
    tiles,
    goldLeft,
    runner,
    monks,
    holes: aged.filter((h) => h.age < HOLE_LIFETIME),
    status: won ? "won" : dead ? "dead" : "playing",
  };
}

/**
 * Digs the brick diagonally below on the given side. The runner digs from the cell
 * nearest to it and snaps onto it, since walking or climbing usually stops between two
 * tiles. It must not be falling; standing on a ladder or hanging on a bar is fine. The
 * target must be an undug brick whose cell above is empty or holds gold (TLR allows
 * digging under gold; the gold stays where it is). A brick, ladder, bar or monk above
 * blocks.
 */
function tryDig(t: Terrain, a: Actor, input: PlayerInput): { runner: Actor; hole: Hole } | null {
  if (input.digLeft === input.digRight) return null;
  const dir: Facing = input.digLeft ? -1 : 1;
  if (isFalling(t, a)) return null;
  const cx = cellOf(a.x + SUB / 2);
  const cy = cellOf(a.y + SUB / 2);
  const snapped: Actor = { ...a, x: cx * SUB, y: cy * SUB };
  if (isFalling(t, snapped)) return null;
  const tx = cx + dir;
  const ty = cy + 1;
  if (tileAt(t, tx, ty) !== TILE.brick || holeAt(t.holes, tx, ty) !== undefined) return null;
  const above = tileAt(t, tx, cy);
  if (above !== TILE.empty && above !== TILE.gold) return null;
  // A monk standing over the target blocks it (1982 rule).
  if (monkAt(t, tx, cy)) return null;
  return {
    runner: { ...snapped, facing: dir, busy: HOLE_TICKS.digging },
    hole: { cx: tx, cy: ty, age: 0 },
  };
}
