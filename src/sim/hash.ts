import type { GameState } from "./state";

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * FNV-1a 32-bit hash over a canonical byte serialization of the state. The field order
 * is fixed here, never taken from object key order, so the hash is stable across
 * engines and refactors that reorder properties.
 */
export function hashState(s: GameState): number {
  let h = FNV_OFFSET;
  const byte = (b: number): void => {
    h = Math.imul(h ^ (b & 0xff), FNV_PRIME) >>> 0;
  };
  const int = (n: number): void => {
    const v = n | 0;
    byte(v);
    byte(v >>> 8);
    byte(v >>> 16);
    byte(v >>> 24);
  };

  int(s.tick);
  int(s.rng);
  int(s.width);
  int(s.height);
  for (const row of s.tiles) {
    int(row.length);
    for (let i = 0; i < row.length; i++) int(row.charCodeAt(i));
  }
  int(s.runner.x);
  int(s.runner.y);
  int(s.runner.facing);
  // When adding a field to GameState, add it here too (hash.test.ts checks each field).

  return h;
}
