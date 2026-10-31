import type { Level } from "../../src/level/format";
import { NO_INPUT, type PlayerInput } from "../../src/sim/input";
import { SUB } from "../../src/sim/rules";
import { createState, type GameState, type Player, type PlayerCount } from "../../src/sim/state";
import { step } from "../../src/sim/step";

/** Builds a level from rows without validation (tests use tiny, partial levels). */
export function levelFrom(rows: readonly string[]): Level {
  return {
    version: 3,
    name: "test",
    width: rows[0]?.length ?? 0,
    height: rows.length,
    grid: rows,
    teleports: [],
    world: "moss",
    night: false,
  };
}

export function stateFrom(rows: readonly string[], seed = 1, players: PlayerCount = 1): GameState {
  return createState(levelFrom(rows), seed, players);
}

/** Player `index` (player 1 by default); throws if the game has no such player. */
export function p1(s: GameState, index = 0): Player {
  const p = s.players[index];
  if (p === undefined) throw new Error(`no player ${String(index + 1)}`);
  return p;
}

/** The state with player `index` changed by `patch`. */
export function withPlayer(s: GameState, patch: Partial<Player>, index = 0): GameState {
  return { ...s, players: s.players.map((p, i) => (i === index ? { ...p, ...patch } : p)) };
}

/** Places the runner (player 1) at an exact sub-unit position (e.g. on a ladder or a bar). */
export function placeRunner(s: GameState, x: number, y: number): GameState {
  return withPlayer(s, { x, y });
}

/** One tick with player 1's input only. */
export function stepOne(s: GameState, input: PlayerInput): GameState {
  return step(s, [input]);
}

export function atCell(s: GameState, cx: number, cy: number): GameState {
  return placeRunner(s, cx * SUB, cy * SUB);
}

export function run(s: GameState, input: PlayerInput, ticks: number): GameState {
  let out = s;
  for (let i = 0; i < ticks; i++) out = step(out, [input]);
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
  return { x: p1(s).x / SUB, y: p1(s).y / SUB };
}
