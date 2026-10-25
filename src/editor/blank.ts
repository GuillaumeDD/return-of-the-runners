import { LIMITS, TILE } from "../level/format";

/** Default size of a new level: the 1982 grid, until TLR's is confirmed. */
export const NEW_LEVEL_SIZE = { width: 28, height: 16 } as const;

/**
 * An empty grid standing on a bedrock floor: where every new level starts. The size is
 * clamped to the level format's limits (8–64 × 8–48).
 */
export function blankGrid(
  width: number = NEW_LEVEL_SIZE.width,
  height: number = NEW_LEVEL_SIZE.height,
): string[] {
  width = clampSize(width, LIMITS.minWidth, LIMITS.maxWidth, LIMITS.minWidth);
  height = clampSize(height, LIMITS.minHeight, LIMITS.maxHeight, LIMITS.minHeight);
  const empty = TILE.empty.repeat(width);
  return Array.from({ length: height }, (_, y) =>
    y === height - 1 ? TILE.bedrock.repeat(width) : empty,
  );
}

/** Clamps an integer size to [min, max]; anything that is not an integer gives `fallback`. */
export function clampSize(n: number, min: number, max: number, fallback: number): number {
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
