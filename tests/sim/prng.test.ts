import { describe, expect, it } from "vitest";
import { prngInt, prngNext } from "../../src/sim/prng";

function sequence(seed: number, n: number): number[] {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    const r = prngNext(s);
    out.push(r.value);
    s = r.state;
  }
  return out;
}

describe("prng", () => {
  it("same seed gives the same sequence", () => {
    expect(sequence(7, 100)).toEqual(sequence(7, 100));
  });

  it("different seeds give different sequences", () => {
    expect(sequence(7, 10)).not.toEqual(sequence(8, 10));
  });

  it("outputs unsigned 32-bit integers", () => {
    for (const v of sequence(123, 1000)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("matches the committed reference sequence for seed 42", () => {
    // Guards against accidental algorithm changes, which would break every replay.
    expect(sequence(42, 8)).toEqual(REFERENCE_SEED_42);
  });

  it("prngInt stays in [0, n)", () => {
    let s = 99;
    for (const n of [1, 2, 3, 7, 28, 1000]) {
      for (let i = 0; i < 500; i++) {
        const r = prngInt(s, n);
        expect(r.value).toBeGreaterThanOrEqual(0);
        expect(r.value).toBeLessThan(n);
        s = r.state;
      }
    }
  });

  it("prngInt rejects invalid bounds", () => {
    for (const n of [0, -1, 1.5, Number.NaN, 2 ** 32]) {
      expect(() => prngInt(1, n)).toThrow(RangeError);
    }
  });
});

// Matches the well-known mulberry32(42) output (first value / 2^32 = 0.6011037519201636).
const REFERENCE_SEED_42 = [
  2581720956, 1925393290, 3661312704, 2876485805, 750819978, 2261697747, 1173505300, 2683257857,
];
