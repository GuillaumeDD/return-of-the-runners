/**
 * Painted backdrops, kept as images: painting one takes a few milliseconds, drawing it
 * back each frame almost nothing. One per world, night and size at a sheet's scale; a
 * few at most are kept (resizing a level in the editor makes new sizes).
 */
import { paintBackdrop } from "./art/backdrops";
import type { Surface } from "./sprites";
import type { World } from "../level/format";

/** How many painted backdrops a sheet keeps, the oldest making room. */
export const MAX_BACKDROPS = 4;

/** A backdrop for a scene and a logical size, or null when none could be painted. */
export type Backdrops = (
  world: World,
  night: boolean,
  width: number,
  height: number,
) => CanvasImageSource | null;

/**
 * The backdrops of one scale: painted on demand into `surface` at `scale` device pixels
 * per logical pixel, then kept. A failure (no surface, a throwing drawing) is kept too,
 * as null, so it is not retried every frame.
 */
export function backdrops(scale: number, surface: Surface): Backdrops {
  const kept = new Map<string, CanvasImageSource | null>();
  return (world, night, width, height) => {
    const key = `${world}:${String(night)}:${String(width)}x${String(height)}`;
    const hit = kept.get(key);
    if (hit !== undefined) {
      // Refresh its place: the oldest is the least recently used.
      kept.delete(key);
      kept.set(key, hit);
      return hit;
    }
    let image: CanvasImageSource | null = null;
    try {
      const made = surface(Math.ceil(width * scale), Math.ceil(height * scale));
      if (made !== null) {
        made.ctx.scale(scale, scale);
        paintBackdrop(made.ctx, width, height, world, night);
        image = made.image;
      }
    } catch {
      image = null;
    }
    kept.set(key, image);
    while (kept.size > MAX_BACKDROPS) {
      const oldest = kept.keys().next().value;
      if (oldest === undefined) break;
      kept.delete(oldest);
    }
    return image;
  };
}
