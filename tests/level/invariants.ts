import { expect } from "vitest";
import { LIMITS, TILE, TILE_CHARS, codePoints, type Level } from "../../src/level/format";

/** Every accepted level must satisfy all of these. */
export function expectLevelInvariants(level: Level): void {
  expect(level.version).toBe(1);
  expect(level.name.trim().length).toBeGreaterThan(0);
  expect(codePoints(level.name).length).toBeLessThanOrEqual(LIMITS.maxNameLength);
  expect(Number.isInteger(level.width)).toBe(true);
  expect(Number.isInteger(level.height)).toBe(true);
  expect(level.width).toBeGreaterThanOrEqual(LIMITS.minWidth);
  expect(level.width).toBeLessThanOrEqual(LIMITS.maxWidth);
  expect(level.height).toBeGreaterThanOrEqual(LIMITS.minHeight);
  expect(level.height).toBeLessThanOrEqual(LIMITS.maxHeight);
  expect(level.grid).toHaveLength(level.height);
  const cells = level.grid.flatMap((row) => codePoints(row));
  for (const row of level.grid) expect(codePoints(row)).toHaveLength(level.width);
  for (const c of cells) expect(TILE_CHARS.has(c)).toBe(true);
  const count = (t: string): number => cells.filter((c) => c === t).length;
  expect(count(TILE.runnerStart)).toBe(1);
  expect(count(TILE.gold)).toBeGreaterThan(0);
  expect(count(TILE.exit)).toBeGreaterThan(0);
  expect(count(TILE.monkStart)).toBeLessThanOrEqual(LIMITS.maxMonks);
}
