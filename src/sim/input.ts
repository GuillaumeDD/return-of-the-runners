/** One player's controls for one tick, as the simulation sees them. */
export interface PlayerInput {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
  readonly digLeft: boolean;
  readonly digRight: boolean;
  /** Pick up, swap or drop an item (`items.ts`); acts once per press. */
  readonly pickUp: boolean;
}

export const NO_INPUT: PlayerInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  digLeft: false,
  digRight: false,
  pickUp: false,
};

/** Every player's input for one tick, player 1 first; a missing entry is no input. */
export type TickInput = readonly PlayerInput[];
