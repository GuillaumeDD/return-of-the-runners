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
 * caller draws in logical pixels. The CSS width is then nudged to the backing store
 * (by a few pixels at most), so each canvas pixel is exactly one device pixel. Returns
 * the scale, for sprite sheets drawn at it.
 */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  logical: { readonly width: number; readonly height: number },
): number {
  const dpr = window.devicePixelRatio;
  canvas.style.width = ""; // measure the width the style sheet gives
  const shown = canvas.getBoundingClientRect().width;
  const store = backingStore(logical, shown, dpr);
  // Setting a size clears the canvas and its state, so only when it changes.
  if (canvas.width !== store.width) canvas.width = store.width;
  if (canvas.height !== store.height) canvas.height = store.height;
  if (shown > 0 && dpr > 0) canvas.style.width = `${String(store.width / dpr)}px`;
  ctx.setTransform(store.scale, 0, 0, store.scale, 0, 0);
  return store.scale;
}
