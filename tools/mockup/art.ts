/**
 * B-030 mockups: items and actors, drawn as vectors in a 32 px cell. `flat` turns the
 * shaded look (gradients, dark outline) into the flat glow one (solid fills, halo).
 */
import { type Actor, type Ctx, T } from "./common";

export interface Look {
  flat: boolean;
}

type Stops = readonly string[];

function paint(
  ctx: Ctx,
  look: Look,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  s: Stops,
): string | CanvasGradient {
  if (look.flat || s.length === 1) return s[Math.floor(s.length / 2)] ?? "#fff";
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  s.forEach((c, i) => {
    g.addColorStop(i / (s.length - 1), c);
  });
  return g;
}

/** Fill the current path, with a dark outline (shaded) or a halo (flat). */
function finish(
  ctx: Ctx,
  look: Look,
  fill: string | CanvasGradient,
  glow: string,
  line = 1.5,
): void {
  ctx.fillStyle = fill;
  if (look.flat) {
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fill();
    ctx.strokeStyle = "rgba(20,10,5,0.85)";
    ctx.lineWidth = line;
    ctx.stroke();
  }
}

export const KEY_COLOR: Readonly<Record<string, Stops>> = {
  a: ["#ff8a7a", "#e8443a", "#8c1c14"],
  b: ["#9df08a", "#3fbf4a", "#1c6b24"],
  c: ["#8ab8ff", "#3a7be8", "#173f8c"],
};

/** The bow of a key and the emblem of its door: circle (red), square (green), triangle (blue). */
function emblem(ctx: Ctx, kind: string, x: number, y: number, r: number): void {
  ctx.beginPath();
  if (kind === "a") ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (kind === "b") ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  else {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y + r * 0.8);
    ctx.lineTo(x - r, y + r * 0.8);
    ctx.closePath();
  }
}

export const GOO = ["#f0a3ff", "#c35bd6", "#6e1f86"] as const;

/** Draws item `c` in the cell whose top-left corner is the origin. */
export function drawItem(ctx: Ctx, c: string, look: Look): void {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  switch (c) {
    case "$": {
      ctx.beginPath();
      ctx.moveTo(6, 30);
      ctx.lineTo(26, 30);
      ctx.lineTo(22, 21);
      ctx.lineTo(10, 21);
      ctx.closePath();
      finish(
        ctx,
        look,
        paint(ctx, look, 0, 21, 0, 30, ["#fff6b0", "#ffcc1a", "#c98a00"]),
        "#ffd23a",
      );
      if (!look.flat) {
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillRect(12, 22.5, 7, 1.5);
      }
      break;
    }
    case "E": {
      ctx.beginPath();
      ctx.moveTo(6, 32);
      ctx.lineTo(6, 13);
      ctx.arc(16, 13, 10, Math.PI, 0);
      ctx.lineTo(26, 32);
      ctx.closePath();
      finish(
        ctx,
        look,
        paint(ctx, look, 0, 3, 0, 32, ["#8a8f99", "#5b606a", "#3a3d44"]),
        "#ffe9a8",
        2,
      );
      ctx.beginPath();
      ctx.moveTo(10, 32);
      ctx.lineTo(10, 14);
      ctx.arc(16, 14, 6, Math.PI, 0);
      ctx.lineTo(22, 32);
      ctx.closePath();
      ctx.fillStyle = paint(ctx, look, 0, 8, 0, 32, ["#ffffff", "#fff1b8", "#ffc94d"]);
      ctx.fill();
      break;
    }
    case "n": {
      ctx.beginPath();
      ctx.moveTo(4, 32);
      ctx.lineTo(4, 14);
      ctx.arc(16, 14, 12, Math.PI, 0);
      ctx.lineTo(28, 32);
      ctx.closePath();
      finish(
        ctx,
        look,
        paint(ctx, look, 0, 2, 0, 32, ["#9c9488", "#6d665c", "#4a443c"]),
        "#9aa",
        2,
      );
      ctx.beginPath();
      ctx.moveTo(8, 32);
      ctx.lineTo(8, 15);
      ctx.arc(16, 15, 8, Math.PI, 0);
      ctx.lineTo(24, 32);
      ctx.closePath();
      ctx.fillStyle = look.flat ? "#05070a" : "rgba(8,6,4,0.92)";
      ctx.fill();
      break;
    }
    case "T":
    case "t": {
      const glow =
        c === "T" ? ["#e6ffff", "#4fe6ff", "#0b7fa8"] : ["#ffe6ff", "#c77dff", "#5a1f99"];
      ctx.beginPath();
      ctx.ellipse(16, 18, 7, 11, 0, 0, Math.PI * 2);
      ctx.fillStyle = paint(ctx, look, 0, 7, 0, 29, glow);
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.ellipse(16, 18, 9, 13, 0, 0, Math.PI * 2);
      ctx.strokeStyle = glow[1] ?? "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
      // The entrance draws in (arrow down), the exit sends out (arrow up).
      ctx.beginPath();
      if (c === "T") {
        ctx.moveTo(12, 15);
        ctx.lineTo(16, 20);
        ctx.lineTo(20, 15);
      } else {
        ctx.moveTo(12, 20);
        ctx.lineTo(16, 15);
        ctx.lineTo(20, 20);
      }
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(16, 30, 11, 2.5, 0, 0, Math.PI * 2);
      finish(
        ctx,
        look,
        paint(ctx, look, 0, 27, 0, 32, ["#c9ced6", "#6f7783"]),
        glow[1] ?? "#fff",
        1,
      );
      break;
    }
    case "a":
    case "b":
    case "c": {
      const s = KEY_COLOR[c] ?? ["#fff"];
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
      finish(ctx, look, paint(ctx, look, 0, 24, 0, 30, s), s[1] ?? "#fff", 1);
      emblem(ctx, c, 10, 26, 5);
      finish(ctx, look, paint(ctx, look, 0, 21, 0, 31, s), s[1] ?? "#fff", 1.2);
      ctx.beginPath();
      ctx.arc(10, 26, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fill();
      break;
    }
    case "A":
    case "B":
    case "C": {
      const k = c.toLowerCase();
      const s = KEY_COLOR[k] ?? ["#fff"];
      ctx.beginPath();
      ctx.rect(2, 1, 28, 31);
      finish(
        ctx,
        look,
        paint(ctx, look, 0, 0, 32, 32, ["#7a5a3a", "#5a3f26", "#3a2716"]),
        s[1] ?? "#fff",
        2,
      );
      ctx.strokeStyle = s[1] ?? "#fff";
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 3, 24, 27);
      emblem(ctx, k, 16, 12, 6);
      finish(ctx, look, paint(ctx, look, 0, 6, 0, 18, s), s[1] ?? "#fff", 1.2);
      ctx.beginPath();
      ctx.arc(16, 22, 2.2, 0, Math.PI * 2);
      ctx.rect(15, 22, 2, 5);
      ctx.fillStyle = "#120a04";
      ctx.fill();
      break;
    }
    case "j": {
      ctx.beginPath();
      ctx.rect(9, 9, 14, 3);
      ctx.rect(14, 11, 4, 3);
      finish(ctx, look, paint(ctx, look, 0, 9, 0, 14, ["#3a3a3a", "#1c1c1c"]), "#ffd23a", 1);
      ctx.beginPath();
      ctx.rect(11, 14, 10, 10);
      finish(
        ctx,
        look,
        paint(ctx, look, 11, 0, 21, 0, ["#ffe066", "#f2b705", "#a87400"]),
        "#ffd23a",
      );
      ctx.beginPath();
      ctx.moveTo(14.5, 24);
      ctx.lineTo(17.5, 24);
      ctx.lineTo(16, 31);
      ctx.closePath();
      finish(ctx, look, paint(ctx, look, 14, 0, 18, 0, ["#e6e9ee", "#8a919c"]), "#cfd6e0", 1);
      break;
    }
    case "k": {
      ctx.beginPath();
      ctx.moveTo(9, 30);
      ctx.lineTo(21, 12);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = look.flat ? "#c08a4a" : "#8a5a2b";
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.quadraticCurveTo(20, 6, 29, 17);
      ctx.quadraticCurveTo(20, 10, 12, 13);
      ctx.closePath();
      finish(
        ctx,
        look,
        paint(ctx, look, 0, 6, 0, 17, ["#eef1f5", "#9aa3ad", "#5b636e"]),
        "#cfd6e0",
        1.2,
      );
      break;
    }
    case "o":
    case "O": {
      const r = c === "o" ? 5.5 : 8.5;
      const cy = 31 - r;
      ctx.beginPath();
      ctx.arc(16, cy, r, 0, Math.PI * 2);
      const g = look.flat
        ? "#3b3f4a"
        : (() => {
            const rg = ctx.createRadialGradient(14 - r / 3, cy - r / 3, 1, 16, cy, r);
            rg.addColorStop(0, "#6b7080");
            rg.addColorStop(1, "#14161b");
            return rg;
          })();
      finish(ctx, look, g, "#ff8a3d");
      if (c === "O") {
        ctx.beginPath();
        ctx.rect(7.5, cy - 1.5, 17, 3);
        ctx.fillStyle = look.flat ? "#ff8a3d" : "#b0883a";
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(16, cy - r);
      ctx.quadraticCurveTo(17, cy - r - 4, 20, cy - r - 5);
      ctx.strokeStyle = "#d8c49a";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(20.5, cy - r - 5.5, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = "#fff2a8";
      ctx.fill();
      break;
    }
    case "s": {
      ctx.beginPath();
      ctx.ellipse(16, 28, 10, 3.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = look.flat ? "#f5d78e" : "#a8864e";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(16, 24.5);
      ctx.lineTo(16, 17);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(14, 15, 4, 3);
      finish(ctx, look, "#6b4a2a", "#f5d78e", 1);
      break;
    }
    case "g": {
      ctx.beginPath();
      ctx.rect(10, 13, 11, 18);
      finish(
        ctx,
        look,
        paint(ctx, look, 10, 0, 21, 0, ["#b8e0a0", "#6a9a50", "#3a5a2a"]),
        "#9dff7a",
      );
      ctx.fillStyle = "#f2c200";
      ctx.fillRect(10, 20, 11, 3);
      ctx.beginPath();
      ctx.rect(14, 9, 3, 4);
      ctx.rect(14, 9, 10, 2.5);
      finish(ctx, look, "#5b636e", "#cfd6e0", 1);
      break;
    }
    case "u": {
      ctx.beginPath();
      ctx.moveTo(8, 17);
      ctx.lineTo(24, 17);
      ctx.lineTo(22, 31);
      ctx.lineTo(10, 31);
      ctx.closePath();
      finish(
        ctx,
        look,
        paint(ctx, look, 8, 0, 24, 0, ["#c9ced6", "#8a919c", "#4b525a"]),
        "#c35bd6",
      );
      ctx.beginPath();
      ctx.ellipse(16, 17, 8, 2.5, 0, 0, Math.PI * 2);
      ctx.moveTo(10, 17);
      ctx.quadraticCurveTo(9, 22, 11, 23);
      ctx.quadraticCurveTo(12, 21, 13, 18);
      ctx.fillStyle = paint(ctx, look, 0, 14, 0, 23, GOO);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(16, 11, 8, Math.PI * 1.05, Math.PI * 1.95);
      ctx.strokeStyle = "#5b636e";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

interface Palette {
  suit: string;
  shade: string;
  accent: string;
  skin: string;
}

const RUNNER: Readonly<Record<"runner1" | "runner2", Palette>> = {
  runner1: { suit: "#f1f4f6", shade: "#9aa6b2", accent: "#19b8d0", skin: "#f2c9a0" },
  runner2: { suit: "#c6b8ff", shade: "#7a64d6", accent: "#ffffff", skin: "#e8b48a" },
};
const MONK = { robe: "#d42a2a", shade: "#7a1010", eye: "#ffe36b" };
const MONK_FLAT = { robe: "#ff3b5c", shade: "#b0153a", eye: "#fff6b0" };

type P = readonly [number, number];
interface Skeleton {
  head: P;
  neck: P;
  hip: P;
  arms: readonly (readonly P[])[];
  legs: readonly (readonly P[])[];
}

function skeleton(a: Actor): Skeleton {
  switch (a.pose) {
    case "run":
      return {
        head: [18, 10],
        neck: [17, 14],
        hip: [15.5, 21],
        arms: [
          [
            [17, 15],
            [14, 18],
            [12, 21],
          ],
          [
            [17, 15],
            [20, 18],
            [23, 16],
          ],
        ],
        legs: [
          [
            [15.5, 21],
            [12, 25],
            [9, 28.5],
          ],
          [
            [15.5, 21],
            [19.5, 24.5],
            [22, 30.5],
          ],
        ],
      };
    case "bar":
      return {
        head: [16, 11],
        neck: [16, 14],
        hip: [16, 22],
        arms: [
          [
            [15, 14.5],
            [13, 10],
            [13, 6],
          ],
          [
            [17, 14.5],
            [19, 10],
            [19.5, 6],
          ],
        ],
        legs: [
          [
            [16, 22],
            [14.5, 26],
            [14, 30],
          ],
          [
            [16, 22],
            [18, 26],
            [19, 29],
          ],
        ],
      };
    case "climb":
      return {
        head: [16, 10],
        neck: [16, 14],
        hip: [16, 22],
        arms: [
          [
            [14, 15],
            [11, 12],
            [10, 7],
          ],
          [
            [18, 15],
            [21, 18],
            [22, 15],
          ],
        ],
        legs: [
          [
            [15, 22],
            [12, 26],
            [12, 30],
          ],
          [
            [17, 22],
            [20, 24],
            [21, 27],
          ],
        ],
      };
    case "trapped":
      return {
        head: [16, 11],
        neck: [16, 15],
        hip: [16, 23],
        arms: [
          [
            [15, 15.5],
            [11, 12],
            [9, 7],
          ],
          [
            [17, 15.5],
            [21, 12],
            [23, 7],
          ],
        ],
        legs: [
          [
            [15, 23],
            [13, 27],
            [13, 31],
          ],
          [
            [17, 23],
            [19, 27],
            [19, 31],
          ],
        ],
      };
  }
}

function polyline(ctx: Ctx, pts: readonly P[]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

/** Draws an actor in its cell, whose top-left corner is the origin. */
export function drawActor(ctx: Ctx, a: Actor, look: Look): void {
  const k = skeleton(a);
  ctx.save();
  if (a.facing === -1) {
    ctx.translate(T, 0);
    ctx.scale(-1, 1);
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const outline = look.flat ? "transparent" : "rgba(12,6,4,0.9)";
  const limb = (pts: readonly P[], color: string, w: number): void => {
    if (!look.flat) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = w + 2;
      polyline(ctx, pts);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    polyline(ctx, pts);
  };
  if (look.flat) {
    ctx.shadowColor =
      a.kind === "monk" ? MONK_FLAT.robe : a.kind === "runner1" ? "#7ff3ff" : "#c6b8ff";
    ctx.shadowBlur = 9;
  }

  if (a.kind === "monk") {
    const m = look.flat ? MONK_FLAT : MONK;
    for (const l of k.legs) limb(l.slice(1), m.shade, 3);
    for (const arm of k.arms) limb(arm, m.robe, 3.2);
    // The robe: a bell from the shoulders to the knees.
    const [nx, ny] = k.neck;
    const [hx, hy] = k.hip;
    ctx.beginPath();
    ctx.moveTo(nx - 3, ny);
    ctx.lineTo(nx + 3, ny);
    ctx.lineTo(hx + 6, hy + 4);
    ctx.quadraticCurveTo(hx, hy + 6, hx - 6, hy + 4);
    ctx.closePath();
    ctx.fillStyle = paint(ctx, look, hx - 6, 0, hx + 6, 0, [m.robe, m.robe, m.shade]);
    ctx.fill();
    if (!look.flat) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // The hood, pointed at the back, and two glowing eyes.
    const [x, y] = k.head;
    ctx.beginPath();
    ctx.arc(x, y, 4.8, 0, Math.PI * 2);
    ctx.moveTo(x - 3, y - 3);
    ctx.lineTo(x - 7, y - 6);
    ctx.lineTo(x - 4.5, y + 1);
    ctx.fillStyle = m.robe;
    ctx.fill();
    if (!look.flat) ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 1, y + 0.5, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#1a0606";
    ctx.fill();
    ctx.shadowColor = m.eye;
    ctx.shadowBlur = 4;
    ctx.fillStyle = m.eye;
    ctx.fillRect(x + 0.2, y - 0.3, 1.4, 1.4);
    ctx.fillRect(x + 2.4, y - 0.3, 1.4, 1.4);
    ctx.shadowBlur = 0;
    if (a.gold === true) {
      ctx.save();
      ctx.translate(x - 15, y - 25);
      ctx.scale(0.6, 0.6);
      drawItem(ctx, "$", look);
      ctx.restore();
    }
  } else {
    const p = RUNNER[a.kind];
    const back = a.pose === "climb";
    limb(k.legs[0] ?? [], p.shade, 3);
    limb(k.arms[0] ?? [], p.shade, 2.6);
    limb([k.neck, k.hip], p.suit, 4.5);
    limb(k.legs[1] ?? [], p.suit, 3);
    limb(k.arms[1] ?? [], p.suit, 2.6);
    // Belt.
    ctx.fillStyle = p.accent;
    ctx.fillRect(k.hip[0] - 2.5, k.hip[1] - 3, 5, 2);
    const [x, y] = k.head;
    ctx.beginPath();
    ctx.arc(x, y, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = back ? p.suit : p.skin;
    ctx.fill();
    if (!look.flat) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (a.kind === "runner1") {
      // A helmet with a lamp: runner 1's silhouette.
      ctx.beginPath();
      ctx.arc(x, y - 0.5, 4.6, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = p.accent;
      ctx.fill();
      if (!back) {
        ctx.fillStyle = "#fffbe0";
        ctx.fillRect(x + 3, y - 3.5, 2.5, 2);
      }
    } else {
      // A scarf streaming behind: runner 2's silhouette.
      ctx.beginPath();
      ctx.moveTo(x - 1, y + 3.5);
      ctx.quadraticCurveTo(x - 7, y + 2, x - 11, y + 5);
      ctx.quadraticCurveTo(x - 7, y + 5, x - 1, y + 5.5);
      ctx.fillStyle = "#ff6fae";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y - 1, 4.4, Math.PI * 1.05, Math.PI * 1.95);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#5b3fb8";
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Where an actor's cell starts, in playfield pixels. */
export function actorOrigin(a: Actor): [number, number] {
  return [a.x * T, a.y * T];
}
