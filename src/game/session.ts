import type { PlayerInput } from "../sim/input";
import type { GameState } from "../sim/state";
import { step } from "../sim/step";

/** The seed of every play session (the play screen and the editor's test play). */
export const PLAY_SEED = 1;

/** Ticks the end screen (caught or level complete) stays up before the level restarts (1.5 s). */
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
 * Advances one tick; once the runner is caught or has won, restarts the level from
 * `start` after the delay (there is a single level until packs exist).
 */
export function tickSession(session: Session, input: PlayerInput): Session {
  if (session.state.status !== "playing") {
    const endTicks = session.endTicks + 1;
    if (endTicks >= RESTART_DELAY_TICKS) return createSession(session.start);
    return { ...session, endTicks };
  }
  return { ...session, state: step(session.state, input) };
}
