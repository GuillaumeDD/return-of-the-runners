/**
 * Which sprite a cell shows: slabs (brick, trapdoor turf, gooey turf; bedrock) join
 * their neighbours of the same kind into one slab, so their sprite depends on the four
 * cells around them. Pure functions of the grid.
 */
import { TILE } from "../level/format";
import { AUTOTILED, SLAB_VARIANTS, slabKey, tileArt } from "./sprites";

/** Bits of a slab's neighbour mask: set when that neighbour continues the slab. */
export const SIDE = { up: 1, right: 2, down: 4, left: 8 } as const;

/**
 * The slab a tile belongs to: diggable ones (brick, and the turfs that look like it)
 * join together, bedrock joins bedrock; anything else is no slab.
 */
export function slabOf(tile: string): "soft" | "hard" | null {
  if (tile === TILE.brick || tile === TILE.trapdoor || tile === TILE.gooeyTurf) return "soft";
  if (tile === TILE.bedrock) return "hard";
  return null;
}

/**
 * Which neighbours of (cx, cy) continue its slab. Outside the grid counts as continuing
 * it: a slab meets the level's edge without a rounded corner or a lit rim.
 */
export function slabMask(rows: readonly string[], cx: number, cy: number): number {
  const own = slabOf(rows[cy]?.charAt(cx) ?? "");
  const same = (x: number, y: number): boolean => {
    const row = rows[y];
    if (row === undefined || x < 0 || x >= row.length) return true;
    return slabOf(row.charAt(x)) === own;
  };
  return (
    (same(cx, cy - 1) ? SIDE.up : 0) |
    (same(cx + 1, cy) ? SIDE.right : 0) |
    (same(cx, cy + 1) ? SIDE.down : 0) |
    (same(cx - 1, cy) ? SIDE.left : 0)
  );
}

/** One of the slab textures, alternating along rows and columns. */
export function slabVariant(cx: number, cy: number): number {
  return (((cx + 2 * cy) % SLAB_VARIANTS) + SLAB_VARIANTS) % SLAB_VARIANTS;
}

/** The sprite of the tile at (cx, cy), or null when it has no art. */
export function cellSprite(rows: readonly string[], cx: number, cy: number): string | null {
  const art = tileArt(rows[cy]?.charAt(cx) ?? "");
  if (art === null || !AUTOTILED.has(art)) return art;
  return slabKey(art, slabMask(rows, cx, cy), slabVariant(cx, cy));
}
