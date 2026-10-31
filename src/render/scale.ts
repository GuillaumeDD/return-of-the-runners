/**
 * Crisp canvases on any screen: the backing store matches the device pixels the canvas
 * covers, and the renderers keep drawing in logical pixels (`TILE_PX` a tile) through a
 * scale transform. See docs/ARCHITECTURE.md § Art direction.
 */
import { TILE_PX } from "./canvas";

/** Highest device pixels per logical pixel: caps memory on huge or zoomed screens. */
export const MAX_SCALE = 4;

export interface BackingStore {
  /** Canvas size in device pixels: whole numbers. */
  readonly width: number;
  readonly height: number;
  /** Device pixels per logical pixel; a tile is always a whole number of them. */
  readonly scale: number;
}

/**
 * The backing store for a canvas of `logical` size shown `cssWidth` CSS pixels wide on
 * a screen of `dpr` device pixels per CSS pixel. A canvas not laid out yet (`cssWidth`
 * 0) is assumed shown at its logical size. The scale is rounded down so that a tile covers a
 * whole number of device pixels, which keeps tile edges sharp and the size whole.
 */
export function backingStore(
  logical: { readonly width: number; readonly height: number },
  cssWidth: number,
  dpr: number,
): BackingStore {
  if (logical.width <= 0 || logical.height <= 0) return { width: 0, height: 0, scale: 1 };
  const ratio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const shown = Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : logical.width;
  const wanted = Math.min(MAX_SCALE, (shown * ratio) / logical.width);
  // Rounded down, so the canvas never grows wider than the space it was given.
  const tile = Math.max(1, Math.floor(wanted * TILE_PX + 1e-9));
  const scale = tile / TILE_PX;
  return {
    width: Math.round(logical.width * scale),
    height: Math.round(logical.height * scale),
    scale,
  };
}

/**
 * Sizes `canvas` for `logical` content on this screen and sets the transform, so the
 * caller draws in logical pixels. It is shown `cssWidth` CSS pixels wide, or, without
 * one, at the width the style sheet gives it. The CSS width is then nudged to the backing store
 * (by a few pixels at most), so each canvas pixel is exactly one device pixel. Returns
 * the scale, for sprite sheets drawn at it.
 */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  logical: { readonly width: number; readonly height: number },
  cssWidth?: number,
): number {
  const dpr = window.devicePixelRatio;
  let shown = cssWidth ?? 0;
  if (cssWidth === undefined) {
    canvas.style.width = ""; // measure the width the style sheet gives
    shown = canvas.getBoundingClientRect().width;
  }
  const store = backingStore(logical, shown, dpr);
  // Setting a size clears the canvas and its state, so only when it changes.
  if (canvas.width !== store.width) canvas.width = store.width;
  if (canvas.height !== store.height) canvas.height = store.height;
  if (shown > 0 && dpr > 0) canvas.style.width = `${String(store.width / dpr)}px`;
  ctx.setTransform(store.scale, 0, 0, store.scale, 0, 0);
  return store.scale;
}

/**
 * The game's size, picked by the player (B-048): "fit" shows the whole page in the
 * window, a percentage is that share of the logical size (100 % = a tile of `TILE_PX`
 * CSS pixels). Never wider than the space the page gives the canvas.
 */
export const GAME_SIZES = ["fit", 50, 75, 100, 150, 200] as const;
export type GameSize = (typeof GAME_SIZES)[number];

/** A stored size, read back: anything else (missing, edited, old) is "fit". */
export function parseGameSize(text: string | null): GameSize {
  return GAME_SIZES.find((s) => String(s) === text) ?? "fit";
}

/** Below this share of its logical size, "fit" stops shrinking and the page scrolls. */
const FIT_FLOOR = 0.25;

/**
 * The CSS width to show a canvas of `logical` size at, for `size`, when the page gives
 * it `room.width` CSS pixels across and `room.height` down (the window's height less
 * everything else on the page).
 */
export function gameWidth(
  size: GameSize,
  logical: { readonly width: number; readonly height: number },
  room: { readonly width: number; readonly height: number },
): number {
  if (logical.width <= 0 || logical.height <= 0) return 0;
  const wanted =
    size === "fit"
      ? Math.max(
          logical.width * FIT_FLOOR,
          // 1 CSS pixel spare: rounding to whole device pixels can add up to half of one.
          ((room.height - 1) * logical.width) / logical.height,
        )
      : (logical.width * size) / 100;
  return Math.max(1, Math.min(room.width, wanted));
}
