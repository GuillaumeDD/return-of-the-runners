import { TILE, type Level } from "../level/format";
import { countGold } from "./gold";
import type { Hole } from "./holes";
import { SUB } from "./rules";

export type Facing = -1 | 1;

export interface Actor {
  /** Position of the actor's top-left corner, in sub-units. */
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
  /** Ticks left in an action that blocks movement (digging); 0 when free. */
  readonly busy: number;
}

/**
 * What a monk is doing. `free`: chasing. `trapped`: stuck in a hole for `timer` ticks.
 * `escaping`: climbing out of the hole at (`holeX`, `holeY`). `dead`: waiting `timer`
 * ticks to reappear.
 */
export type MonkMode = "free" | "trapped" | "escaping" | "dead";

export interface Monk extends Actor {
  readonly mode: MonkMode;
  readonly timer: number;
  /**
   * Gold carrying, as in the 1982 game: 0 carries nothing; n > 0 carries gold and tries
   * to drop it after n more cells; n < 0 just dropped gold and waits -n cells before
   * picking any up again.
   */
  readonly carry: number;
  /** The hole a trapped or escaping monk is in; -1 otherwise. */
  readonly holeX: number;
  readonly holeY: number;
}

export type Status = "playing" | "dead" | "won";

/**
 * The whole game state: plain data only (no classes, no functions), so it can be
 * hashed, cloned and compared. `step` returns a new state; it never mutates.
 */
export interface GameState {
  readonly tick: number;
  readonly rng: number;
  readonly width: number;
  readonly height: number;
  /**
   * Terrain, `height` rows of `width` tile chars. Start markers become empty; collected
   * gold is removed.
   */
  readonly tiles: readonly string[];
  /** Gold not yet collected by the runner. The exit opens when it reaches 0. */
  readonly goldLeft: number;
  /** Holes being dug or open, ordered by creation (deterministic). */
  readonly holes: readonly Hole[];
  readonly runner: Actor;
  /** Monks in level reading order (row by row); this order is the update order. */
  readonly monks: readonly Monk[];
  readonly status: Status;
}

export function newMonk(cx: number, cy: number): Monk {
  return {
    x: cx * SUB,
    y: cy * SUB,
    facing: -1,
    busy: 0,
    mode: "free",
    timer: 0,
    carry: 0,
    holeX: -1,
    holeY: -1,
  };
}

export function createState(level: Level, seed: number): GameState {
  const runnerRow = level.grid.findIndex((row) => row.includes(TILE.runnerStart));
  const runnerCol = runnerRow >= 0 ? (level.grid[runnerRow] ?? "").indexOf(TILE.runnerStart) : -1;
  if (runnerRow < 0 || runnerCol < 0) {
    throw new Error("createState: level has no runner start (validate it first)");
  }
  const monks: Monk[] = [];
  level.grid.forEach((row, cy) => {
    for (let cx = 0; cx < row.length; cx++) {
      if (row.charAt(cx) === TILE.monkStart) monks.push(newMonk(cx, cy));
    }
  });
  // Start markers are not terrain: the cells they mark are empty. Player 2 joins with
  // B-020; until then its start is just an empty cell.
  const tiles = level.grid.map((row) =>
    row
      .replaceAll(TILE.runnerStart, TILE.empty)
      .replaceAll(TILE.player2Start, TILE.empty)
      .replaceAll(TILE.monkStart, TILE.empty),
  );
  return {
    tick: 0,
    rng: seed >>> 0,
    width: level.width,
    height: level.height,
    tiles,
    goldLeft: countGold(tiles),
    holes: [],
    runner: { x: runnerCol * SUB, y: runnerRow * SUB, facing: 1, busy: 0 },
    monks,
    status: "playing",
  };
}
