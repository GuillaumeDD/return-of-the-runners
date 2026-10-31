/**
 * The frame around the playfield and the status bar under it (B-036, ARCHITECTURE § Art
 * direction): a riveted dark metal frame, one panel per player (runner, lives, gold, item
 * slot, bombs) and the level's name in the middle, between carved spirals. Drawn on the
 * game canvas, in logical pixels, from the state; never fed back.
 */
import { translate, type Locale } from "../i18n";
import type { PlayerPanel } from "../game/hud";
import { TILE_PX } from "./canvas";
import { drawSprite, tileArt, type SpriteSheet } from "./sprites";

/** The frame's width on the left, right and top of the playfield: half a tile. */
export const FRAME = TILE_PX / 2;
/** The status bar's height under the playfield. */
export const BAR = 40;

/** Where each part goes, for a playfield of `grid` logical pixels. */
export interface FrameLayout {
  readonly width: number;
  readonly height: number;
  /** The playfield's place in the canvas. */
  readonly field: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  /** The vertical middle of the status bar. */
  readonly barMiddle: number;
}

export function frameLayout(grid: {
  readonly width: number;
  readonly height: number;
}): FrameLayout {
  return {
    width: grid.width + 2 * FRAME,
    height: FRAME + grid.height + BAR,
    field: { x: FRAME, y: FRAME, width: grid.width, height: grid.height },
    barMiddle: FRAME + grid.height + BAR / 2,
  };
}

const METAL = ["#4a4e55", "#33363c", "#23252a"] as const;
const COLOR = {
  panel: "#0d0e11",
  panelEdge: "rgba(255,255,255,0.15)",
  rivetDark: "#1a1b1e",
  rivetLight: "#8a9099",
  spiral: "#9aa0a8",
  gold: "#ffc94d",
  text: "#e6e9ee",
  out: "#ff6b5e",
  players: ["#19b8d0", "#c6b8ff"],
} as const;
const FONT = "600 15px ui-monospace, Menlo, Consolas, monospace";
const NAME_FONT = "600 13px system-ui, sans-serif";

/** The width of one player's panel group, and its four panels' offsets and widths. */
const GROUP = {
  width: 220,
  panels: [
    [0, 64],
    [70, 56],
    [132, 34],
    [172, 48],
  ],
} as const;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function rivet(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = COLOR.rivetDark;
  ctx.beginPath();
  ctx.arc(x, y, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR.rivetLight;
  ctx.beginPath();
  ctx.arc(x - 0.5, y - 0.5, 1.4, 0, Math.PI * 2);
  ctx.fill();
}

function spiral(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  const turns = Math.PI * 5;
  for (let a = 0; a <= turns; a += 0.15) {
    const rr = (r * a) / turns;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = COLOR.spiral;
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

/** The metal frame around the playfield, with its rivets, and the bar's plate. */
export function drawFrame(ctx: CanvasRenderingContext2D, layout: FrameLayout): void {
  const { width: w, height: h, field } = layout;
  const metal = ctx.createLinearGradient(0, 0, 0, h);
  metal.addColorStop(0, METAL[0]);
  metal.addColorStop(0.5, METAL[1]);
  metal.addColorStop(1, METAL[2]);
  ctx.fillStyle = metal;
  ctx.fillRect(0, 0, w, field.y);
  ctx.fillRect(0, 0, field.x, h);
  ctx.fillRect(field.x + field.width, 0, w - field.x - field.width, h);
  ctx.fillRect(0, field.y + field.height, w, h - field.y - field.height);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.strokeRect(field.x - 1, field.y - 1, field.width + 2, field.height + 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  for (let x = 24; x < w - 12; x += 48) rivet(ctx, x, FRAME / 2);
  for (let y = 36; y < field.y + field.height; y += 48) {
    rivet(ctx, FRAME / 2, y);
    rivet(ctx, w - FRAME / 2, y);
  }
}

/** A sprite drawn at `k` times its size with its top left at (`x`, `y`); false without art. */
function icon(
  ctx: CanvasRenderingContext2D,
  sheet: SpriteSheet,
  key: string | null,
  x: number,
  y: number,
  k: number,
): boolean {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  const drawn = drawSprite(ctx, sheet, key, 0, 0);
  ctx.restore();
  return drawn;
}

/** `text` cut with an ellipsis to fit `max` logical pixels in the current font. */
export function fitText(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  // Cut between graphemes, so an accent or an emoji is never split.
  const chars = Array.from(new Intl.Segmenter().segment(text), (s) => s.segment);
  while (chars.length > 0 && ctx.measureText(`${chars.join("")}…`).width > max) chars.pop();
  return `${chars.join("")}…`;
}

/** One player's panels: runner and lives, gold, the item slot, bombs. */
function drawPlayer(
  ctx: CanvasRenderingContext2D,
  sheet: SpriteSheet,
  locale: Locale,
  panel: PlayerPanel,
  index: number,
  x: number,
  mid: number,
): void {
  const top = mid - 14;
  ctx.save();
  if (panel.out) ctx.globalAlpha = 0.45;
  for (const [dx, pw] of GROUP.panels) {
    roundRect(ctx, x + dx, top, pw, 28, 5);
    ctx.fillStyle = COLOR.panel;
    ctx.fill();
    ctx.strokeStyle = COLOR.panelEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.font = FONT;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  // Runner and lives: the actor sprite is a tile wide and starts half a tile above its cell.
  const runner = index === 0 ? "runner1/idle:0" : "runner2/idle:0";
  icon(ctx, sheet, runner, x + 3, top - 1, 0.75);
  ctx.fillStyle = COLOR.players[index] ?? COLOR.text;
  ctx.fillText(`×${String(panel.lives)}`, x + 24, mid + 1);
  // Gold taken.
  if (!icon(ctx, sheet, "gold:plain", x + 72, top + 3, 0.75)) {
    ctx.fillStyle = COLOR.gold;
    ctx.fillRect(x + 76, mid - 3, 10, 6);
  }
  ctx.fillStyle = COLOR.gold;
  ctx.fillText(String(panel.gold), x + 94, mid + 1);
  // The item slot: what the player holds, or empty.
  if (panel.item !== "") {
    const [sx] = GROUP.panels[2];
    if (!icon(ctx, sheet, tileArt(panel.item), x + sx + 5, top + 2, 1)) {
      ctx.fillStyle = COLOR.text;
      ctx.textAlign = "center";
      ctx.fillText(panel.item, x + sx + 17, mid + 1);
      ctx.textAlign = "left";
    }
  }
  // Bombs: the next one's sprite, and how many.
  const [bx] = GROUP.panels[3];
  const next = panel.bombs.charAt(0) || "o";
  if (!icon(ctx, sheet, tileArt(next), x + bx + 2, top + 3, 0.75)) {
    ctx.fillStyle = COLOR.text;
    ctx.beginPath();
    ctx.arc(x + bx + 11, mid + 1, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = COLOR.text;
  ctx.fillText(String(panel.bombs.length), x + bx + 26, mid + 1);
  ctx.restore();
  if (panel.out) {
    ctx.save();
    ctx.font = FONT;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = COLOR.out;
    ctx.fillText(translate(locale, "hudOutTag"), x + GROUP.width / 2, mid + 1);
    ctx.restore();
  }
}

/**
 * The status bar: player 1's panels on the left, player 2's on the right, and the
 * level's name in the middle between spirals (shortened to fit).
 */
export function drawHud(
  ctx: CanvasRenderingContext2D,
  layout: FrameLayout,
  sheet: SpriteSheet,
  locale: Locale,
  panels: readonly PlayerPanel[],
  name: string,
): void {
  const { width: w, barMiddle: mid } = layout;
  const left = 34;
  const right = w - 34 - GROUP.width;
  spiral(ctx, 17, mid, 11);
  spiral(ctx, w - 17, mid, 11);
  panels.forEach((panel, i) => {
    drawPlayer(ctx, sheet, locale, panel, i, i === 0 ? left : right, mid);
  });
  // The name between player 1's group and player 2's (or the right edge, alone).
  const from = left + GROUP.width + 30;
  const to = (panels.length > 1 ? right : w - 34) - 30;
  if (to - from < 40) return;
  ctx.save();
  ctx.font = NAME_FONT;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const text = fitText(ctx, name, to - from - 12);
  const centre = (from + to) / 2;
  const half = Math.min((to - from) / 2, ctx.measureText(text).width / 2 + 10);
  spiral(ctx, centre - half - 14, mid, 9);
  spiral(ctx, centre + half + 14, mid, 9);
  roundRect(ctx, centre - half, mid - 12, half * 2, 24, 5);
  ctx.fillStyle = COLOR.panel;
  ctx.fill();
  ctx.strokeStyle = COLOR.panelEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = COLOR.gold;
  ctx.fillText(text, centre, mid + 1);
  ctx.restore();
}
