import { TICKS_PER_SECOND } from "../sim/rules";

export const TICK_MS = 1000 / TICKS_PER_SECOND;

/**
 * Frames longer than this are clamped, so a background tab or a debugger pause does not
 * trigger a burst of catch-up ticks (the "spiral of death").
 */
export const MAX_FRAME_MS = 250;

/** Time is counted in millionths of a tick, so 1000 / 60 ms never accumulates float error. */
const UNITS_PER_TICK = 1_000_000;

export interface Accumulator {
  /** Real time not yet turned into ticks, in millionths of a tick (an integer). */
  readonly carry: number;
}

/**
 * Turns elapsed real time into a whole number of simulation ticks. Pure: returns the
 * number of ticks to run and the new accumulator.
 */
export function advance(acc: Accumulator, elapsedMs: number): { ticks: number; acc: Accumulator } {
  const elapsed = Math.min(Math.max(elapsedMs, 0), MAX_FRAME_MS);
  const total = acc.carry + Math.round((elapsed / TICK_MS) * UNITS_PER_TICK);
  const ticks = Math.floor(total / UNITS_PER_TICK);
  return { ticks, acc: { carry: total - ticks * UNITS_PER_TICK } };
}
