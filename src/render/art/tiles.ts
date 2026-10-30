/**
 * Terrain and items of the Moss world, drawn as vectors in a 32-unit cell (style guide:
 * ARCHITECTURE § Art direction). Terrain is autotiled: each slab variant knows which of
 * its four neighbours belong to the same slab, and rounds or lights its open edges.
 */

const TAU = Math.PI * 2;
const OUTLINE = "rgba(20,10,5,0.85)";

import { SIDE } from "../terrain";

/** Neighbour masks of an autotiled cell (`terrain.ts`, `SIDE`): four bits. */
export const MASKS = 16;

/** Terrain families: diggable slab (brick, trapdoor, goo base) and bedrock. */
export type Slab = "soft" | "hard";

const MOSS = {
  soft: ["#2f6b25", "#4c8f2f", "#5ea83a", "#7fbf4a", "#a6d867"],
  hard: ["#3c4644", "#4a5552", "#5f6b67", "#7a8681", "#8a9690"],
  top: ["#c8f27a", "#5fb339"],
  hardTop: ["#b9c2c4", "#6f7a7c"],
  ladder: ["#c08b4f", "#6b4220"],
  rope: "#c9a66b",
  ropeDark: "rgba(90,60,25,0.8)",
} as const;

export const GOO = ["#f0a3ff", "#c35bd6", "#6e1f86"] as const;

/** A small seeded generator, so every sprite is drawn the same at every load. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  [tl, tr, br, bl]: readonly [number, number, number, number],
): void {
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

/**
 * One slab cell: `mask` says which neighbours continue the slab (`SIDE`); `variant`
 * picks one of two textures, so a long slab does not repeat every cell.
 */
export function drawSlab(
  ctx: CanvasRenderingContext2D,
  slab: Slab,
  mask: number,
  variant: number,
): void {
  const up = (mask & SIDE.up) === 0;
  const right = (mask & SIDE.right) === 0;
  const down = (mask & SIDE.down) === 0;
  const left = (mask & SIDE.left) === 0;
  const R = 8;
  const shades = slab === "soft" ? MOSS.soft : MOSS.hard;
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, 0, 0, 32, 32, [
    up && left ? R : 0,
    up && right ? R : 0,
    down && right ? R : 0,
    down && left ? R : 0,
  ]);
  ctx.fillStyle = shades[1];
  ctx.fill();
  ctx.clip();
  // Texture: seeded speckles of the material's shades.
  const rnd = prng((slab === "soft" ? 31 : 41) + variant * 7);
  for (let i = 0; i < 70; i++) {
    const shade = shades[Math.floor(rnd() * shades.length)] ?? shades[1];
    ctx.fillStyle = shade;
    ctx.globalAlpha = 0.35 + rnd() * 0.4;
    ctx.beginPath();
    ctx.arc(rnd() * 32, rnd() * 32, 1 + rnd() * (slab === "soft" ? 3 : 4.5), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (slab === "hard") {
    // Bedrock: heavy stone with a bevel and a crack.
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 30, 30);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(2, 29);
    ctx.lineTo(2, 2);
    ctx.lineTo(29, 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const cx = variant === 0 ? 9 : 20;
    ctx.moveTo(cx, 6);
    ctx.lineTo(cx + 4, 13);
    ctx.lineTo(cx + 1, 19);
    ctx.stroke();
  } else {
    // A diggable slab shows a faint seam per cell.
    ctx.strokeStyle = "rgba(0,0,0,0.13)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 31, 31);
  }
  if (left) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, 0, 3, 32);
  }
  if (right) {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(28, 0, 4, 32);
  }
  if (down) {
    const sh = ctx.createLinearGradient(0, 22, 0, 32);
    sh.addColorStop(0, "rgba(0,0,0,0)");
    sh.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = sh;
    ctx.fillRect(0, 22, 32, 10);
  }
  ctx.restore();
  if (up) {
    // The lit top edge: grass on moss, pale stone on bedrock.
    const colors = slab === "soft" ? MOSS.top : MOSS.hardTop;
    const top = ctx.createLinearGradient(0, 0, 0, 6);
    top.addColorStop(0, colors[0]);
    top.addColorStop(1, colors[1]);
    ctx.fillStyle = top;
    ctx.beginPath();
    roundRect(ctx, 0, 0, 32, 5, [left ? R / 2 : 0, right ? R / 2 : 0, 0, 0]);
    ctx.fill();
    if (slab === "soft") {
      const blades = prng(5 + variant);
      ctx.fillStyle = MOSS.top[1];
      for (let i = 0; i < 6; i++) {
        const bx = 2 + blades() * 28;
        ctx.beginPath();
        ctx.moveTo(bx - 2, 4);
        ctx.lineTo(bx, 7 + blades() * 6);
        ctx.lineTo(bx + 2, 4);
        ctx.fill();
      }
    }
  }
}

/** Gooey turf: a glossy magenta coat over the slab's top, dripping down its face. */
export function drawGooCoat(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, 0, 12);
  g.addColorStop(0, GOO[0]);
  g.addColorStop(0.5, GOO[1]);
  g.addColorStop(1, GOO[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(32, 0);
  ctx.lineTo(32, 7);
  const drips = [5, 9, 3, 11, 6];
  for (let i = 4; i >= 0; i--) {
    const dx = (i * 32) / 4;
    ctx.quadraticCurveTo(dx + 4, 7 + (drips[i] ?? 4), dx, 7);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(4, 1.5, 8, 1.5);
}

/**
 * A brick (or bedrock) being dug or filling back in: only the bottom `left` of it (from 0
 * to 1) is there, with a crumbled top edge.
 */
export function drawDugSlab(ctx: CanvasRenderingContext2D, slab: Slab, left: number): void {
  const h = 32 * left;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 32);
  ctx.lineTo(0, 32 - h);
  for (let x = 4; x <= 32; x += 4) ctx.lineTo(x, 32 - h + (x % 8 === 0 ? 2 : -1));
  ctx.lineTo(32, 32);
  ctx.closePath();
  ctx.clip();
  drawSlab(ctx, slab, SIDE.up | SIDE.right | SIDE.left, 0);
  ctx.restore();
  // Crumbs at the rim.
  ctx.fillStyle = slab === "soft" ? MOSS.soft[0] : MOSS.hard[0];
  for (const x of [6, 15, 24]) ctx.fillRect(x, 31 - h - 2, 3, 2);
}

function paint(
  ctx: CanvasRenderingContext2D,
  y0: number,
  y1: number,
  stops: readonly string[],
): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => {
    g.addColorStop(i / Math.max(1, stops.length - 1), c);
  });
  return g;
}

function across(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  stops: readonly string[],
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  stops.forEach((c, i) => {
    g.addColorStop(i / Math.max(1, stops.length - 1), c);
  });
  return g;
}

/** Fills the current path, then outlines it. */
function finish(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, line = 1.5): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = line;
  ctx.stroke();
}

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: string,
  a: number,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${String(a)})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}

export const KEY_COLOR: Readonly<Record<"a" | "b" | "c", readonly string[]>> = {
  a: ["#ff8a7a", "#e8443a", "#8c1c14"],
  b: ["#9df08a", "#3fbf4a", "#1c6b24"],
  c: ["#8ab8ff", "#3a7be8", "#173f8c"],
};

/** A key's bow and its door's emblem: circle (red), square (green), triangle (blue). */
export function emblemPath(
  ctx: CanvasRenderingContext2D,
  kind: "a" | "b" | "c",
  x: number,
  y: number,
  r: number,
): void {
  ctx.beginPath();
  if (kind === "a") ctx.arc(x, y, r, 0, TAU);
  else if (kind === "b") ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  else {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y + r * 0.8);
    ctx.lineTo(x - r, y + r * 0.8);
    ctx.closePath();
  }
}

export function drawLadder(ctx: CanvasRenderingContext2D): void {
  for (const rx of [7, 22]) {
    ctx.fillStyle = across(ctx, rx, rx + 4, MOSS.ladder);
    ctx.fillRect(rx, 0, 3.5, 32);
  }
  for (let ry = 4; ry < 32; ry += 8) {
    ctx.fillStyle = MOSS.ladder[1];
    ctx.fillRect(9, ry + 1, 14, 3);
    ctx.fillStyle = MOSS.ladder[0];
    ctx.fillRect(9, ry, 14, 2);
  }
}

export function drawBar(ctx: CanvasRenderingContext2D): void {
  ctx.lineCap = "butt";
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(32, 6);
  ctx.stroke();
  ctx.strokeStyle = MOSS.rope;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = MOSS.ropeDark;
  ctx.lineWidth = 1;
  for (let i = 0; i < 32; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, 5);
    ctx.lineTo(i + 2, 7.5);
    ctx.stroke();
  }
}

export function drawGold(ctx: CanvasRenderingContext2D, halo = true): void {
  if (halo) glow(ctx, 16, 25, 16, "255,200,60", 0.35);
  ctx.beginPath();
  ctx.moveTo(6, 30);
  ctx.lineTo(26, 30);
  ctx.lineTo(22, 21);
  ctx.lineTo(10, 21);
  ctx.closePath();
  finish(ctx, paint(ctx, 21, 30, ["#fff6b0", "#ffcc1a", "#c98a00"]));
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillRect(12, 22.5, 7, 1.5);
}

/** The open exit: a stone arch around a bright doorway. */
export function drawExit(ctx: CanvasRenderingContext2D): void {
  glow(ctx, 16, 18, 16, "255,230,150", 0.4);
  ctx.beginPath();
  ctx.moveTo(6, 32);
  ctx.lineTo(6, 13);
  ctx.arc(16, 13, 10, Math.PI, 0);
  ctx.lineTo(26, 32);
  ctx.closePath();
  finish(ctx, paint(ctx, 3, 32, ["#8a8f99", "#5b606a", "#3a3d44"]), 2);
  ctx.beginPath();
  ctx.moveTo(10, 32);
  ctx.lineTo(10, 14);
  ctx.arc(16, 14, 6, Math.PI, 0);
  ctx.lineTo(22, 32);
  ctx.closePath();
  ctx.fillStyle = paint(ctx, 8, 32, ["#ffffff", "#fff1b8", "#ffc94d"]);
  ctx.fill();
}

export function drawAlcove(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(4, 32);
  ctx.lineTo(4, 14);
  ctx.arc(16, 14, 12, Math.PI, 0);
  ctx.lineTo(28, 32);
  ctx.closePath();
  finish(ctx, paint(ctx, 2, 32, ["#9c9488", "#6d665c", "#4a443c"]), 2);
  ctx.beginPath();
  ctx.moveTo(8, 32);
  ctx.lineTo(8, 15);
  ctx.arc(16, 15, 8, Math.PI, 0);
  ctx.lineTo(24, 32);
  ctx.closePath();
  ctx.fillStyle = "rgba(8,6,4,0.92)";
  ctx.fill();
}

/** A teleporter: the entrance (cyan) draws in, the exit (violet) sends out. */
export function drawTeleporter(ctx: CanvasRenderingContext2D, entrance: boolean): void {
  const colors = entrance ? ["#e6ffff", "#4fe6ff", "#0b7fa8"] : ["#ffe6ff", "#c77dff", "#5a1f99"];
  glow(ctx, 16, 18, 16, entrance ? "80,230,255" : "200,120,255", 0.35);
  ctx.beginPath();
  ctx.ellipse(16, 18, 7, 11, 0, 0, TAU);
  ctx.fillStyle = paint(ctx, 7, 29, colors);
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.ellipse(16, 18, 9, 13, 0, 0, TAU);
  ctx.strokeStyle = colors[1] ?? "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  if (entrance) {
    ctx.moveTo(12, 15);
    ctx.lineTo(16, 20);
    ctx.lineTo(20, 15);
  } else {
    ctx.moveTo(12, 20);
    ctx.lineTo(16, 15);
    ctx.lineTo(20, 20);
  }
  ctx.strokeStyle = "#ffffff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(16, 30, 11, 2.5, 0, 0, TAU);
  finish(ctx, paint(ctx, 27, 32, ["#c9ced6", "#6f7783"]), 1);
}

export function drawKey(ctx: CanvasRenderingContext2D, kind: "a" | "b" | "c"): void {
  const s = KEY_COLOR[kind];
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(14, 25);
  ctx.lineTo(27, 25);
  ctx.lineTo(27, 30);
  ctx.lineTo(25, 30);
  ctx.lineTo(25, 27.5);
  ctx.lineTo(23, 27.5);
  ctx.lineTo(23, 29);
  ctx.lineTo(21, 29);
  ctx.lineTo(21, 27.5);
  ctx.lineTo(14, 27.5);
  ctx.closePath();
  finish(ctx, paint(ctx, 24, 30, s), 1);
  emblemPath(ctx, kind, 10, 26, 5);
  finish(ctx, paint(ctx, 21, 31, s), 1.2);
  ctx.beginPath();
  ctx.arc(10, 26, 1.6, 0, TAU);
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fill();
}

export function drawDoor(ctx: CanvasRenderingContext2D, kind: "a" | "b" | "c"): void {
  const s = KEY_COLOR[kind];
  ctx.beginPath();
  ctx.rect(2, 1, 28, 31);
  finish(ctx, across(ctx, 0, 32, ["#7a5a3a", "#5a3f26", "#3a2716"]), 2);
  ctx.strokeStyle = s[1] ?? "#fff";
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 3, 24, 27);
  emblemPath(ctx, kind, 16, 12, 6);
  finish(ctx, paint(ctx, 6, 18, s), 1.2);
  ctx.beginPath();
  ctx.arc(16, 22, 2.2, 0, TAU);
  ctx.rect(15, 22, 2, 5);
  ctx.fillStyle = "#120a04";
  ctx.fill();
}

export function drawJackhammer(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.rect(9, 9, 14, 3);
  ctx.rect(14, 11, 4, 3);
  finish(ctx, paint(ctx, 9, 14, ["#3a3a3a", "#1c1c1c"]), 1);
  ctx.beginPath();
  ctx.rect(11, 14, 10, 10);
  finish(ctx, across(ctx, 11, 21, ["#ffe066", "#f2b705", "#a87400"]));
  ctx.beginPath();
  ctx.moveTo(14.5, 24);
  ctx.lineTo(17.5, 24);
  ctx.lineTo(16, 31);
  ctx.closePath();
  finish(ctx, across(ctx, 14, 18, ["#e6e9ee", "#8a919c"]), 1);
}

export function drawPickaxe(ctx: CanvasRenderingContext2D): void {
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(9, 30);
  ctx.lineTo(21, 12);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = "#8a5a2b";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(10, 10);
  ctx.quadraticCurveTo(20, 6, 29, 17);
  ctx.quadraticCurveTo(20, 10, 12, 13);
  ctx.closePath();
  finish(ctx, paint(ctx, 6, 17, ["#eef1f5", "#9aa3ad", "#5b636e"]), 1.2);
}

/** A bomb lying on the floor; a big one is larger, with a brass band. */
export function drawBomb(ctx: CanvasRenderingContext2D, big: boolean): void {
  const r = big ? 8.5 : 5.5;
  const cy = 31 - r;
  ctx.beginPath();
  ctx.arc(16, cy, r, 0, TAU);
  const rg = ctx.createRadialGradient(14 - r / 3, cy - r / 3, 1, 16, cy, r);
  rg.addColorStop(0, "#6b7080");
  rg.addColorStop(1, "#14161b");
  finish(ctx, rg);
  if (big) {
    ctx.fillStyle = "#b0883a";
    ctx.fillRect(7.5, cy - 1.5, 17, 3);
  }
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(16, cy - r);
  ctx.quadraticCurveTo(17, cy - r - 4, 20, cy - r - 5);
  ctx.strokeStyle = "#d8c49a";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function drawSnare(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.ellipse(16, 28, 10, 3.5, 0, 0, TAU);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = "#c8a165";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16, 24.5);
  ctx.lineTo(16, 17);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(14, 15, 4, 3);
  finish(ctx, "#6b4a2a", 1);
}

export function drawGasSpray(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.rect(10, 13, 11, 18);
  finish(ctx, across(ctx, 10, 21, ["#b8e0a0", "#6a9a50", "#3a5a2a"]));
  ctx.fillStyle = "#f2c200";
  ctx.fillRect(10, 20, 11, 3);
  ctx.beginPath();
  ctx.rect(14, 9, 3, 4);
  ctx.rect(14, 9, 10, 2.5);
  finish(ctx, "#5b636e", 1);
}

export function drawGooBucket(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(8, 17);
  ctx.lineTo(24, 17);
  ctx.lineTo(22, 31);
  ctx.lineTo(10, 31);
  ctx.closePath();
  finish(ctx, across(ctx, 8, 24, ["#c9ced6", "#8a919c", "#4b525a"]));
  ctx.beginPath();
  ctx.ellipse(16, 17, 8, 2.5, 0, 0, TAU);
  ctx.moveTo(10, 17);
  ctx.quadraticCurveTo(9, 22, 11, 23);
  ctx.quadraticCurveTo(12, 21, 13, 18);
  ctx.fillStyle = paint(ctx, 14, 23, GOO);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(16, 11, 8, Math.PI * 1.05, Math.PI * 1.95);
  ctx.strokeStyle = "#5b636e";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
