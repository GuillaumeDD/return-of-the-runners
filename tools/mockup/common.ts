/**
 * B-030 art direction mockups: the scene shared by the three directions. A mockup is a
 * still picture of `first-steps` with a few actors posed by hand; it never runs the
 * simulation. See docs/plans/step-4.md § Three directions to mock up.
 */
import level from "../../src/levels/first-steps.json";

export const T = 32;
export const COLS = 28;
export const ROWS = 16;
export const FRAME = 16;
export const BAR = 64;
export const PW = COLS * T;
export const PH = ROWS * T;
export const W = PW + 2 * FRAME;
export const H = PH + 2 * FRAME + BAR;

export type World = "moss" | "lava";
export type Style = "pixel" | "diorama" | "glow";
export type Ctx = CanvasRenderingContext2D;

/** Cells dug open in the scene (a monk is trapped in the first one). */
export const HOLES: readonly (readonly [number, number])[] = [[17, 10]];

/** Editor-only marks and starts are not drawn: the actors stand in for them. */
const HIDDEN = new Set(["P", "Q", "M", "R", "h"]);

export const GRID: readonly string[] = level.grid.map((row, y) =>
  row.replace(/./g, (c, x: number) =>
    HIDDEN.has(c) || HOLES.some(([hx, hy]) => hx === x && hy === y) ? "." : c,
  ),
);

export function cell(x: number, y: number): string {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return "@";
  return GRID[y]?.[x] ?? ".";
}

export const SOFT = new Set(["#", "%", "~"]);
export const isSoft = (c: string): boolean => SOFT.has(c);
export const isHard = (c: string): boolean => c === "@";

export type Pose = "run" | "bar" | "climb" | "trapped";
export interface Actor {
  kind: "runner1" | "runner2" | "monk";
  /** Cell coordinates; fractions place an actor between cells. */
  x: number;
  y: number;
  pose: Pose;
  facing: 1 | -1;
  gold?: boolean;
}

export const ACTORS: readonly Actor[] = [
  { kind: "runner1", x: 6.4, y: 4, pose: "run", facing: 1 },
  { kind: "runner2", x: 9, y: 7, pose: "bar", facing: -1 },
  { kind: "monk", x: 17, y: 10, pose: "trapped", facing: -1 },
  { kind: "monk", x: 20.4, y: 9, pose: "run", facing: -1, gold: true },
  { kind: "monk", x: 22, y: 12.4, pose: "climb", facing: 1 },
];

export const HUD = {
  level: 1,
  goldLeft: 6,
  players: [
    { lives: 5, score: 4250, item: "j", bombs: 2 },
    { lives: 3, score: 1800, item: "u", bombs: 0 },
  ],
} as const;

/** Seeded PRNG (mulberry32): mockups must render the same picture every time. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Value noise in [0, 1). */
export function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

export type RGB = readonly [number, number, number];

export function hex(c: string): RGB {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** A canvas texture filled pixel by pixel from `color(x, y)`. */
export function texture(
  w: number,
  h: number,
  color: (x: number, y: number) => RGB,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (g === null) throw new Error("no 2d context");
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, gg, b] = color(x, y);
      const i = (y * w + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = gg;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (g === null) throw new Error("no 2d context");
  return [c, g];
}

export function roundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: readonly [number, number, number, number],
): void {
  const [tl, tr, br, bl] = r;
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

/** Each cell of the grid, with its pixel position inside the playfield. */
export function eachCell(
  fn: (c: string, x: number, y: number, px: number, py: number) => void,
): void {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) fn(cell(x, y), x, y, x * T, y * T);
  }
}
