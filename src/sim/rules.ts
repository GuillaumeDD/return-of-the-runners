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
export const RUNNER_PERIOD = {
  walk: 2,
  climb: 2,
  bar: 2,
  fall: 1,
} as const;

/** Digging and holes. A hole goes through: digging → open → closing → brick again. */
export const HOLE_TICKS = {
  /** The brick is still solid while being dug; the runner cannot move meanwhile. */
  digging: 15,
  /** Fully open: actors can fall in and walk through. */
  open: 240,
  /** Refilling: still passable; whoever is inside when it ends dies. */
  closing: 30,
} as const;
