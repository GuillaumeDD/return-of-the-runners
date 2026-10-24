import { TILE, type Level } from "../level/format";
import { SUB } from "./rules";

export type Facing = -1 | 1;

export interface Actor {
  /** Position of the actor's top-left corner, in sub-units. */
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
}

/**
 * The whole game state: plain data only (no classes, no functions), so it can be
 * hashed, cloned and compared. `step` returns a new state; it never mutates.
 */
export interface GameState {
  readonly tick: number;
  readonly rng: number;
  readonly width: number;
  readonly height: number;
  /** Static terrain, `height` rows of `width` tile chars; start markers become empty. */
  readonly tiles: readonly string[];
  readonly runner: Actor;
}

export function createState(level: Level, seed: number): GameState {
  const runnerRow = level.grid.findIndex((row) => row.includes(TILE.runnerStart));
  const runnerCol = runnerRow >= 0 ? (level.grid[runnerRow] ?? "").indexOf(TILE.runnerStart) : -1;
  if (runnerRow < 0 || runnerCol < 0) {
    throw new Error("createState: level has no runner start (validate it first)");
  }
  // Start markers are not terrain: the cells they mark are empty. Monks arrive in B-008.
  const tiles = level.grid.map((row) =>
    row.replaceAll(TILE.runnerStart, TILE.empty).replaceAll(TILE.monkStart, TILE.empty),
  );
  return {
    tick: 0,
    rng: seed >>> 0,
    width: level.width,
    height: level.height,
    tiles,
    runner: { x: runnerCol * SUB, y: runnerRow * SUB, facing: 1 },
  };
}
