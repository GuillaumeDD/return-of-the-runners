/**
 * Seeded PRNG (mulberry32). Pure: the state is a plain 32-bit integer stored in the
 * simulation state, so the whole game stays hashable and replayable.
 */

export interface PrngStep {
  /** Unsigned 32-bit output. */
  readonly value: number;
  readonly state: number;
}

export function prngNext(state: number): PrngStep {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: (t ^ (t >>> 14)) >>> 0, state: s };
}

/** Integer in [0, n). `n` must be a positive integer below 2^32. */
export function prngInt(
  state: number,
  n: number,
): { readonly value: number; readonly state: number } {
  if (!Number.isInteger(n) || n <= 0 || n > 0xffffffff) {
    throw new RangeError(`prngInt: n must be a positive 32-bit integer, got ${String(n)}`);
  }
  const step = prngNext(state);
  // Modulo bias is at most n / 2^32, negligible for the small n used in game logic.
  return { value: step.value % n, state: step.state };
}
