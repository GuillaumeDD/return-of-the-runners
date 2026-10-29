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

/**
 * Walking on gooey turf, for runners and monks alike: one sub-unit every 6 ticks (a
 * third of the runner's speed, half the monk's; provisional, S-002 only says it slows).
 */
export const GOO_PERIOD = 6;

/**
 * Ticks an actor spends in a teleporter, between vanishing at the entrance and
 * appearing at the exit (0.75 s; S-025 @ 0:04–0:05 shows 0.5 to 1 s, read at 4 frames
 * per second; agreed by Guillaume, 2026-10-29).
 */
export const TELEPORT_TICKS = 45;

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

/** Lives each player starts a level with (both players show 05 at the start, S-026). */
export const START_LIVES = 5;

/**
 * In a two-player game, ticks a caught or buried player waits before reappearing at its
 * start (1.5 s, like the level restart after a one-player death; provisional).
 */
export const PLAYER_RESPAWN_TICKS = 90;
