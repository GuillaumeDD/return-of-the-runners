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
  width = clamp(width, LIMITS.minWidth, LIMITS.maxWidth);
  height = clamp(height, LIMITS.minHeight, LIMITS.maxHeight);
  const empty = TILE.empty.repeat(width);
  return Array.from({ length: height }, (_, y) =>
    y === height - 1 ? TILE.bedrock.repeat(width) : empty,
  );
}

function clamp(n: number, min: number, max: number): number {
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : min;
}
