/** One player's controls for one tick, as the simulation sees them. */
export interface PlayerInput {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
}

export const NO_INPUT: PlayerInput = { left: false, right: false, up: false, down: false };
