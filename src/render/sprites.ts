/**
 * Sprite sheets: the art is drawn in code (vectors and seeded textures) once, at the
 * scale the canvas is shown at, into one offscreen canvas; frames are then copied
 * from it. Anything without art yet falls back to the placeholder shapes of `canvas.ts`.
 * See docs/ARCHITECTURE.md § Art direction.
 */
import type { TileChar } from "../level/format";

/** A sprite: its size in logical pixels and how to draw it there, at the origin. */
export interface SpriteDef {
  readonly key: string;
  readonly width: number;
  readonly height: number;
  readonly draw: (ctx: CanvasRenderingContext2D) => void;
}

interface Frame {
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
  readonly width: number;
  readonly height: number;
}

export interface SpriteSheet {
  readonly scale: number;
  readonly image: CanvasImageSource | null;
  readonly frames: ReadonlyMap<string, Frame>;
}

/** A blank drawing surface of whole device pixels, or null where none can be made. */
export type Surface = (
  width: number,
  height: number,
) => { readonly image: CanvasImageSource; readonly ctx: CanvasRenderingContext2D } | null;

/** One pixel between frames, so smoothing never bleeds a neighbour in. */
const GAP = 1;

/** Widest row of a sheet, in device pixels: well under every browser's canvas limit. */
export const MAX_ROW = 4096;

/**
 * Draws every sprite of `defs` at `scale` into one surface, in rows of at most
 * `MAX_ROW` pixels (a wider sprite gets a row of its own). A sprite
 * whose drawing throws is left out (it falls back), and so is everything when no
 * surface can be made: building a sheet never throws.
 */
export function buildSheet(
  defs: readonly SpriteDef[],
  scale: number,
  surface: Surface,
): SpriteSheet {
  const empty: SpriteSheet = { scale, image: null, frames: new Map() };
  if (defs.length === 0) return empty;
  const sizes = defs.map((d) => ({
    sw: Math.ceil(d.width * scale),
    sh: Math.ceil(d.height * scale),
  }));
  // Shelf packing: left to right, a new row when the next sprite would overflow.
  const places: { sx: number; sy: number }[] = [];
  let x = 0;
  let y = 0;
  let row = 0;
  let width = 0;
  for (const s of sizes) {
    if (x > 0 && x + s.sw > MAX_ROW) {
      y += row + GAP;
      x = 0;
      row = 0;
    }
    places.push({ sx: x, sy: y });
    x += s.sw + GAP;
    row = Math.max(row, s.sh);
    width = Math.max(width, x);
  }
  const height = y + row;
  let made: ReturnType<Surface>;
  try {
    made = surface(width, height);
  } catch {
    return empty;
  }
  if (made === null) return empty;
  const frames = new Map<string, Frame>();
  defs.forEach((d, i) => {
    const s = sizes[i] ?? { sw: 0, sh: 0 };
    const { sx, sy } = places[i] ?? { sx: 0, sy: 0 };
    made.ctx.save();
    try {
      made.ctx.setTransform(scale, 0, 0, scale, sx, sy);
      // Nothing a sprite draws outside its box may land on a neighbour's.
      made.ctx.beginPath();
      made.ctx.rect(0, 0, d.width, d.height);
      made.ctx.clip();
      d.draw(made.ctx);
      frames.set(d.key, { sx, sy, ...s, width: d.width, height: d.height });
    } catch {
      made.ctx.setTransform(1, 0, 0, 1, 0, 0);
      made.ctx.clearRect(sx, sy, s.sw, s.sh);
    } finally {
      made.ctx.restore();
    }
  });
  return { scale, image: made.image, frames };
}

/** Draws sprite `key` with its top-left corner at (x, y); false when it has no art. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sheet: SpriteSheet,
  key: string | null | undefined,
  x: number,
  y: number,
): boolean {
  if (key === null || key === undefined || sheet.image === null) return false;
  const f = sheet.frames.get(key);
  if (f === undefined) return false;
  ctx.drawImage(sheet.image, f.sx, f.sy, f.sw, f.sh, x, y, f.width, f.height);
  return true;
}

/** An animation: how many frames, played at how many frames a second, looping. */
export interface Animation {
  readonly name: string;
  readonly frames: number;
  readonly fps: number;
}

/**
 * The frame of `anim` shown at `timeMs` (render time, never simulation state): it
 * depends on nothing else, and loops within the animation's length.
 */
export function frameAt(anim: Animation, timeMs: number): number {
  if (anim.frames <= 1 || !Number.isFinite(timeMs) || timeMs < 0) return 0;
  return Math.floor((timeMs * anim.fps) / 1000) % anim.frames;
}

/** The sprite key of one frame of an animation. */
export function frameKey(anim: Animation, frame: number): string {
  return `${anim.name}:${String(frame)}`;
}

/**
 * The sprite of each tile, or null while it is drawn as a placeholder. Typed over every
 * tile of the format, so a new tile without an entry does not compile (and a test checks
 * the list against `format.ts`). The art lands with B-033 and B-035.
 */
export const TILE_ART: Readonly<Record<TileChar, string | null>> = {
  ".": null,
  "#": null,
  "@": null,
  H: null,
  "-": null,
  $: null,
  E: null,
  P: null,
  M: null,
  Q: null,
  "%": null,
  "~": null,
  h: null,
  R: null,
  n: null,
  T: null,
  t: null,
  a: null,
  b: null,
  c: null,
  A: null,
  B: null,
  C: null,
  j: null,
  k: null,
  o: null,
  O: null,
  s: null,
  g: null,
  u: null,
};

/** The sprite key of a tile character, if it has art. */
export function tileArt(tile: string): string | null {
  return Object.hasOwn(TILE_ART, tile) ? (TILE_ART[tile as TileChar] ?? null) : null;
}
