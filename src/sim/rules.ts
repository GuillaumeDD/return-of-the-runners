/**
 * Every tunable gameplay constant lives here, as an integer.
 *
 * Values are provisional (taken from the feel of the 1982 game) until checked against
 * the original TLR; see docs/ARCHITECTURE.md § Observed behavior of the original game.
 */

/** Simulation ticks per second. */
export const TICKS_PER_SECOND = 60;

/** Sub-units per tile, on both axes. Positions are integers in sub-units. */
export const SUB = 8;

/** An actor moves one sub-unit every `period` ticks (lower is faster). */
export interface Period {
  readonly walk: number;
  readonly climb: number;
  readonly bar: number;
  readonly fall: number;
}

export const RUNNER_PERIOD: Period = {
  walk: 2,
  climb: 2,
  bar: 2,
  fall: 1,
};

/** Monks are slower than the runner (1982 feel: about two thirds of its speed). */
export const MONK_PERIOD: Period = {
  walk: 3,
  climb: 3,
  bar: 3,
  fall: 2,
};

export const MONK_TICKS = {
  /** Stuck in a hole before climbing out (if the hole has not refilled by then). */
  trapped: 120,
  /** Hidden after dying in a refilled hole, before reappearing near the top. */
  respawn: 60,
} as const;

/**
 * A monk that picks up gold carries it for `min + n` cells, n drawn from the PRNG in
 * [0, spread), then drops it on the next free floor cell (1982 rule: 12 to 37 cells).
 */
export const MONK_CARRY = { min: 12, spread: 26 } as const;

/** Digging and holes. A hole goes through: digging → open → closing → brick again. */
export const HOLE_TICKS = {
  /** The brick is still solid while being dug; the runner cannot move meanwhile. */
  digging: 15,
  /** Fully open: actors can fall in and walk through. */
  open: 240,
  /** Refilling: still passable; whoever is inside when it ends dies. */
  closing: 30,
} as const;
