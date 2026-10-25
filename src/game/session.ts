import type { PlayerInput } from "../sim/input";
import type { GameState } from "../sim/state";
import { step } from "../sim/step";

/** Ticks the death screen stays up before the level restarts (1.5 s). */
export const RESTART_DELAY_TICKS = 90;

/** One play session of a level: the simulation plus how long the runner has been dead. */
export interface Session {
  readonly start: GameState;
  readonly state: GameState;
  readonly deadTicks: number;
}

export function createSession(start: GameState): Session {
  return { start, state: start, deadTicks: 0 };
}

/** Advances one tick; restarts the level from `start` once the death delay is over. */
export function tickSession(session: Session, input: PlayerInput): Session {
  if (session.state.status === "dead") {
    const deadTicks = session.deadTicks + 1;
    if (deadTicks >= RESTART_DELAY_TICKS) return createSession(session.start);
    return { ...session, deadTicks };
  }
  return { ...session, state: step(session.state, input) };
}
