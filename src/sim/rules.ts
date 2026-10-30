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

/**
 * Ticks a jackhammer takes to drill one cell, before the player falls in: with the
 * fall, about 5 cells in 9 s (S-019 @ 2:33–2:43, to measure better; provisional).
 */
export const DRILL_TICKS = 100;

/** Ticks a pickaxe swing keeps the player busy (as long as digging a hole; provisional). */
export const PICK_TICKS = 15;

/** Ticks landed rubble stays before it crumbles (7 s; S-021 shows at least 7 s; provisional). */
export const RUBBLE_TICKS = 420;

/** Ticks a lit bomb burns before it explodes (2.5 s, S-015 @ 1:05–1:07.5). */
export const FUSE_TICKS = 150;

/**
 * Ticks a brick blown away by a small bomb stays open before it comes back (13 s,
 * S-015 @ 1:07.5–1:21; provisional).
 */
export const CRATER_TICKS = 780;

/**
 * Gas gun (S-021 @ 0:53–1:05, read at 2 frames per second; provisional): a cloud covers
 * `GAS_CELLS` cells in front of the player for `GAS_TICKS` (6.5 s: fired @ 0:54, gone
 * @ 1:01); a monk caught in it stays dazed `DAZE_TICKS` more once it clears (2.5 s, the
 * stars spin until @ 1:03.5). Firing keeps the player busy `GAS_FIRE_TICKS`.
 */
export const GAS_CELLS = 3;
export const GAS_TICKS = 390;
export const DAZE_TICKS = 150;
export const GAS_FIRE_TICKS = 15;

/** Ticks a blast is drawn after it goes off (drawing only, but kept in the state). */
export const BLAST_TICKS = 20;

export const MONK_TICKS = {
  /** Stuck in a hole before climbing out (if the hole has not refilled by then). */
  trapped: 120,
  /** Hidden after dying in a refilled hole, before reappearing near the top. */
  respawn: 60,
} as const;

/**
 * Ticks a monk roams toward one spot when no player is in sight (a player hides in an
 * alcove) before it picks another (4 s; provisional, TLR's own wandering is unknown).
 */
export const ROAM_TICKS = 240;

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
