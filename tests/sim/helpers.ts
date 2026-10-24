import type { Level } from "../../src/level/format";
import { NO_INPUT, type PlayerInput } from "../../src/sim/input";
import { SUB } from "../../src/sim/rules";
import { createState, type GameState } from "../../src/sim/state";
import { step } from "../../src/sim/step";

/** Builds a level from rows without validation (tests use tiny, partial levels). */
export function levelFrom(rows: readonly string[]): Level {
  return {
    version: 1,
    name: "test",
    width: rows[0]?.length ?? 0,
    height: rows.length,
    grid: rows,
  };
}

export function stateFrom(rows: readonly string[], seed = 1): GameState {
  return createState(levelFrom(rows), seed);
}

/** Places the runner at an exact sub-unit position (e.g. on a ladder or a bar). */
export function placeRunner(s: GameState, x: number, y: number): GameState {
  return { ...s, runner: { ...s.runner, x, y } };
}

export function atCell(s: GameState, cx: number, cy: number): GameState {
  return placeRunner(s, cx * SUB, cy * SUB);
}

export function run(s: GameState, input: PlayerInput, ticks: number): GameState {
  let out = s;
  for (let i = 0; i < ticks; i++) out = step(out, input);
  return out;
}

export const press = {
  none: NO_INPUT,
  left: { ...NO_INPUT, left: true },
  right: { ...NO_INPUT, right: true },
  up: { ...NO_INPUT, up: true },
  down: { ...NO_INPUT, down: true },
  leftRight: { ...NO_INPUT, left: true, right: true },
} as const satisfies Record<string, PlayerInput>;

export function cell(s: GameState): { x: number; y: number } {
  return { x: s.runner.x / SUB, y: s.runner.y / SUB };
}
