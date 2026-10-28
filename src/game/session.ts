import type { TickInput } from "../sim/input";
import type { GameState, PlayerCount } from "../sim/state";
import { step } from "../sim/step";

/**
 * How a level is played: alone, or two players working together (`coop`: one player
 * out wins the level for both) or racing for the gold (`versus`: the first player out
 * wins). The simulation is the same in both two-player modes (shared gold, any exit,
 * holes bury either player); only who wins differs, so replays do not record the mode.
 */
export type PlayMode = "solo" | "coop" | "versus";

export const PLAY_MODES: readonly PlayMode[] = ["solo", "coop", "versus"];

export function playerCount(mode: PlayMode): PlayerCount {
  return mode === "solo" ? 1 : 2;
}

/** The seed of every play session (the play screen and the editor's test play). */
export const PLAY_SEED = 1;

/** Ticks the end screen (level lost or complete) stays up before the level restarts (1.5 s). */
export const RESTART_DELAY_TICKS = 90;

/** One play session of a level: the simulation plus how long the game has been over. */
export interface Session {
  readonly start: GameState;
  readonly state: GameState;
  readonly endTicks: number;
}

export function createSession(start: GameState): Session {
  return { start, state: start, endTicks: 0 };
}

/**
 * Advances one tick; once the level is lost or won, restarts it from `start` after the
 * delay (there is a single level until packs exist).
 */
export function tickSession(session: Session, inputs: TickInput): Session {
  if (session.state.status !== "playing") {
    const endTicks = session.endTicks + 1;
    if (endTicks >= RESTART_DELAY_TICKS) return createSession(session.start);
    return { ...session, endTicks };
  }
  return { ...session, state: step(session.state, inputs) };
}
