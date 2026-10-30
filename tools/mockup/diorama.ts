/**
 * B-030 direction 2, the illustrated diorama: vector tiles with soft shading, a layered
 * painted backdrop, light on gold and portals. The neo-pixel mockup reuses these layers
 * and turns them into pixel art.
 */
import { actorOrigin, drawActor, drawItem, GOO, type Look } from "./art";
import {
  ACTORS,
  BAR,
  canvas,
  type Ctx,
  cell,
  COLS,
  eachCell,
  fbm,
  FRAME,
  H,
  HOLES,
  hex,
  HUD,
  isHard,
  isSoft,
  mix,
  PH,
  prng,
  PW,
  type RGB,
  roundRect,
  ROWS,
  T,
  texture,
  W,
  type World,
} from "./common";

const SHADED: Look = { flat: false };

interface Theme {
  sky: readonly [string, string];
  soft: readonly [RGB, RGB, RGB];
  top: readonly [string, string];
  hard: readonly [RGB, RGB];
  ladder: readonly [string, string];
  bar: string;
}

const THEME: Readonly<Record<World, Theme>> = {
  moss: {
    sky: ["#1c3a24", "#0b1c12"],
    soft: [hex("#2f6b25"), hex("#5ea83a"), hex("#a6d867")],
    top: ["#c8f27a", "#5fb339"],
    hard: [hex("#4a5552"), hex("#8a9690")],
    ladder: ["#b8834a", "#6b4220"],
    bar: "#c9a66b",
  },
  lava: {
    sky: ["#3a0f08", "#1a0503"],
    soft: [hex("#8a3a14"), hex("#cc6a2c"), hex("#f2a35e")],
    top: ["#ffd9a0", "#e08a3c"],
    hard: [hex("#2a2526"), hex("#5a4f4e")],
    ladder: ["#aeb6bf", "#4b525a"],
    bar: "#9aa3ad",
  },
};

function css([r, g, b]: RGB, a = 1): string {
  return `rgba(${String(Math.round(r))},${String(Math.round(g))},${String(Math.round(b))},${String(a)})`;
}

/** The painted scene behind the grid: calm and dim, so the terrain stays loud. */
export function drawBackdrop(ctx: Ctx, world: World): void {
  const th = THEME[world];
  const rnd = prng(world === "moss" ? 11 : 23);
  const sky = ctx.createLinearGradient(0, 0, 0, PH);
  sky.addColorStop(0, th.sky[0]);
  sky.addColorStop(1, th.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, PW, PH);

  const ridge = (
    base: number,
    amp: number,
    scale: number,
    seed: number,
    color: string,
    fromTop = false,
  ): void => {
    ctx.beginPath();
    ctx.moveTo(0, fromTop ? 0 : PH);
    for (let x = 0; x <= PW; x += 4) {
      const n = fbm(x / scale, 0.5, seed, 5);
      ctx.lineTo(x, fromTop ? base + n * amp : base - n * amp);
    }
    ctx.lineTo(PW, fromTop ? 0 : PH);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  if (world === "moss") {
    // Light shafts through the canopy.
    for (const sx of [180, 470, 720]) {
      const g = ctx.createLinearGradient(sx, 0, sx - 160, PH);
      g.addColorStop(0, "rgba(210,255,170,0.10)");
      g.addColorStop(1, "rgba(210,255,170,0)");
      ctx.beginPath();
      ctx.moveTo(sx - 30, 0);
      ctx.lineTo(sx + 30, 0);
      ctx.lineTo(sx - 120, PH);
      ctx.lineTo(sx - 230, PH);
      ctx.fillStyle = g;
      ctx.fill();
    }
    ridge(PH * 0.62, 220, 160, 3, "#173222");
    // Tree trunks.
    for (const [tx, tw] of [
      [70, 46],
      [330, 30],
      [610, 54],
      [840, 34],
    ] as const) {
      const g = ctx.createLinearGradient(tx, 0, tx + tw, 0);
      g.addColorStop(0, "#1f3a26");
      g.addColorStop(0.3, "#2a4a30");
      g.addColorStop(1, "#11241a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(tx, 0);
      ctx.bezierCurveTo(tx - 10, PH * 0.4, tx + 14, PH * 0.7, tx - 16, PH);
      ctx.lineTo(tx + tw + 18, PH);
      ctx.bezierCurveTo(tx + tw + 6, PH * 0.7, tx + tw - 6, PH * 0.4, tx + tw, 0);
      ctx.fill();
    }
    ridge(PH * 0.86, 90, 90, 5, "#132a1c");
    // Big leaves in the foreground.
    for (let i = 0; i < 26; i++) {
      const x = rnd() * PW;
      const y = PH * (0.55 + rnd() * 0.5);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-1.2 + rnd() * 2.4);
      const l = 30 + rnd() * 50;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(l * 0.5, -l * 0.28, l, 0);
      ctx.quadraticCurveTo(l * 0.5, l * 0.28, 0, 0);
      ctx.fillStyle = `rgba(40,80,46,${String(0.35 + rnd() * 0.3)})`;
      ctx.fill();
      ctx.restore();
    }
    // Hanging vines.
    ctx.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      const x = rnd() * PW;
      const len = 60 + rnd() * 200;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 20, len * 0.3, x - 20, len * 0.6, x + 6, len);
      ctx.strokeStyle = "rgba(48,92,52,0.55)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    // Fireflies.
    for (let i = 0; i < 18; i++) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 7);
      g.addColorStop(0, "rgba(230,255,140,0.8)");
      g.addColorStop(1, "rgba(230,255,140,0)");
      ctx.save();
      ctx.translate(rnd() * PW, rnd() * PH);
      ctx.fillStyle = g;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.restore();
    }
  } else {
    ridge(PH * 0.5, 260, 200, 7, "#2a0a06");
    // Stalactites from the cave roof.
    ctx.fillStyle = "#200704";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= PW; x += 18) {
      const d = 20 + fbm(x / 40, 1, 9, 3) * 120 * (rnd() * 0.6 + 0.4);
      ctx.lineTo(x + 9, d);
      ctx.lineTo(x + 18, 10 + rnd() * 20);
    }
    ctx.lineTo(PW, 0);
    ctx.fill();
    ridge(PH * 0.9, 120, 70, 13, "#2e0c07");
    // The lava river and its glow.
    const glow = ctx.createLinearGradient(0, PH - 200, 0, PH);
    glow.addColorStop(0, "rgba(255,90,20,0)");
    glow.addColorStop(1, "rgba(255,110,30,0.45)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, PH - 200, PW, 200);
    ctx.beginPath();
    ctx.moveTo(0, PH);
    for (let x = 0; x <= PW; x += 6)
      ctx.lineTo(x, PH - 46 + Math.round(fbm(x / 50, 3, 17, 3) * 24));
    ctx.lineTo(PW, PH);
    const river = ctx.createLinearGradient(0, PH - 50, 0, PH);
    river.addColorStop(0, "#ffd36b");
    river.addColorStop(0.35, "#ff7a1f");
    river.addColorStop(1, "#a8200c");
    ctx.fillStyle = river;
    ctx.fill();
    // Embers.
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,${String(140 + Math.floor(rnd() * 100))},60,${String(0.4 + rnd() * 0.5)})`;
      const s = 1 + rnd() * 2;
      ctx.fillRect(rnd() * PW, PH * 0.3 + rnd() * PH * 0.6, s, s);
    }
  }
  // Keep the scene dim behind the terrain.
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, PW, PH);
}

function materialTexture(world: World, hard: boolean): HTMLCanvasElement {
  const th = THEME[world];
  if (hard) {
    return texture(128, 128, (x, y) => {
      const n = fbm(x / 10, y / 10, 41, 4);
      const crack = Math.abs(fbm(x / 22, y / 22, 43, 3) - 0.5) < 0.025 ? 0.45 : 1;
      return mix(th.hard[0], th.hard[1], n * crack);
    });
  }
  return texture(128, 128, (x, y) => {
    const n = fbm(x / 7, y / 7, world === "moss" ? 31 : 37, 5);
    const speck = fbm(x / 1.6, y / 1.6, 33, 2);
    const base =
      n < 0.5 ? mix(th.soft[0], th.soft[1], n * 2) : mix(th.soft[1], th.soft[2], (n - 0.5) * 2);
    return mix(base, speck > 0.62 ? th.soft[2] : th.soft[0], 0.22);
  });
}

/** Terrain, ladders, bars and items, as one layer that casts a shadow on the backdrop. */
export function drawTerrain(ctx: Ctx, world: World, shadow = true): void {
  const th = THEME[world];
  const [layer, g] = canvas(PW, PH);
  const soft = g.createPattern(materialTexture(world, false), "repeat");
  const hard = g.createPattern(materialTexture(world, true), "repeat");
  const rnd = prng(world === "moss" ? 5 : 6);
  const R = 8;

  eachCell((c, x, y, px, py) => {
    const isS = isSoft(c);
    const isH = isHard(c);
    if (!isS && !isH) return;
    const same = (dx: number, dy: number): boolean => {
      const n = cell(x + dx, y + dy);
      return isS ? isSoft(n) : isHard(n);
    };
    const edge = (dx: number, dy: number): boolean =>
      !same(dx, dy) && !(x + dx < 0 || x + dx >= COLS || y + dy >= ROWS);
    const up = !same(0, -1) && y > 0;
    const down = edge(0, 1);
    const left = edge(-1, 0);
    const right = edge(1, 0);
    g.beginPath();
    roundRect(g, px, py, T, T, [
      up && left ? R : 0,
      up && right ? R : 0,
      down && right ? R : 0,
      down && left ? R : 0,
    ]);
    g.fillStyle = (isS ? soft : hard) ?? "#777";
    g.fill();
    g.save();
    g.clip();
    if (isH) {
      // Bedrock: heavy stones with a bevel.
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.lineWidth = 2;
      g.strokeRect(px + 1, py + 1, T - 2, T - 2);
      g.strokeStyle = "rgba(255,255,255,0.10)";
      g.beginPath();
      g.moveTo(px + 2, py + T - 3);
      g.lineTo(px + 2, py + 2);
      g.lineTo(px + T - 3, py + 2);
      g.stroke();
      if (world === "lava") {
        g.fillStyle = "rgba(255,120,40,0.5)";
        for (const [rx, ry] of [
          [6, 6],
          [T - 6, 6],
          [6, T - 6],
          [T - 6, T - 6],
        ] as const) {
          g.beginPath();
          g.arc(px + rx, py + ry, 1.6, 0, Math.PI * 2);
          g.fill();
        }
      }
    } else {
      // Diggable slab: a faint brick seam per cell.
      g.strokeStyle = "rgba(0,0,0,0.13)";
      g.lineWidth = 1;
      g.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      if (world === "lava") {
        g.fillStyle = "rgba(255,210,150,0.25)";
        g.fillRect(px + 6, py + 10, 14, 4);
        g.fillStyle = "rgba(60,15,0,0.25)";
        g.fillRect(px + 6, py + 14, 14, 2);
      }
    }
    if (left) {
      g.fillStyle = "rgba(255,255,255,0.08)";
      g.fillRect(px, py, 3, T);
    }
    if (right) {
      g.fillStyle = "rgba(0,0,0,0.22)";
      g.fillRect(px + T - 4, py, 4, T);
    }
    if (down) {
      const sh = g.createLinearGradient(0, py + T - 10, 0, py + T);
      sh.addColorStop(0, "rgba(0,0,0,0)");
      sh.addColorStop(1, "rgba(0,0,0,0.45)");
      g.fillStyle = sh;
      g.fillRect(px, py + T - 10, T, 10);
    }
    g.restore();
    if (up) {
      // The lit top edge: grass on moss, a pale crust on lava, grey on bedrock.
      const top = g.createLinearGradient(0, py, 0, py + 6);
      top.addColorStop(0, isH ? "#b9c2c4" : th.top[0]);
      top.addColorStop(1, isH ? "#6f7a7c" : th.top[1]);
      g.fillStyle = top;
      g.beginPath();
      roundRect(g, px, py, T, 5, [left ? R / 2 : 0, right ? R / 2 : 0, 0, 0]);
      g.fill();
      if (isS && world === "moss") {
        g.fillStyle = th.top[1];
        for (let i = 0; i < 6; i++) {
          const bx = px + 2 + rnd() * (T - 4);
          g.beginPath();
          g.moveTo(bx - 2, py + 4);
          g.lineTo(bx, py + 7 + rnd() * 6);
          g.lineTo(bx + 2, py + 4);
          g.fill();
        }
        g.fillStyle = th.top[0];
        for (let i = 0; i < 4; i++) {
          const bx = px + 2 + rnd() * (T - 4);
          g.beginPath();
          g.moveTo(bx - 1.5, py + 1);
          g.lineTo(bx + rnd() * 2 - 1, py - 3 - rnd() * 3);
          g.lineTo(bx + 1.5, py + 1);
          g.fill();
        }
      }
    }
    if (down && isS && world === "lava") {
      g.fillStyle = "#e08a3c";
      for (let i = 0; i < 3; i++) {
        const bx = px + 4 + rnd() * (T - 8);
        g.beginPath();
        g.moveTo(bx - 2, py + T);
        g.lineTo(bx, py + T + 3 + rnd() * 5);
        g.lineTo(bx + 2, py + T);
        g.fill();
      }
    }
    if (c === "~") {
      // Gooey turf: glossy goo over the top, dripping down the face.
      g.fillStyle = (() => {
        const gg = g.createLinearGradient(0, py - 2, 0, py + 12);
        gg.addColorStop(0, GOO[0]);
        gg.addColorStop(0.5, GOO[1]);
        gg.addColorStop(1, GOO[2]);
        return gg;
      })();
      g.beginPath();
      g.moveTo(px, py - 2);
      g.lineTo(px + T, py - 2);
      g.lineTo(px + T, py + 7);
      for (let i = 4; i >= 0; i--) {
        const dx = px + (i * T) / 4;
        g.quadraticCurveTo(dx + 4, py + 7 + ((i * 7 + x * 3) % 9), dx, py + 7);
      }
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.55)";
      g.fillRect(px + 4, py, 8, 1.5);
    }
  });

  // Dug holes: a dark pit with crumbs at the rim.
  for (const [hx, hy] of HOLES) {
    const px = hx * T;
    const py = hy * T;
    g.fillStyle = "rgba(10,5,2,0.55)";
    g.fillRect(px + 2, py, T - 4, T);
    g.fillStyle = css(th.soft[0]);
    for (let i = 0; i < 5; i++) g.fillRect(px + 3 + rnd() * (T - 8), py + T - 4 - rnd() * 3, 3, 3);
  }

  // Ladders and bars.
  eachCell((c, _x, _y, px, py) => {
    if (c === "H") {
      for (const rx of [7, 22]) {
        const rail = g.createLinearGradient(px + rx, 0, px + rx + 4, 0);
        rail.addColorStop(0, th.ladder[0]);
        rail.addColorStop(1, th.ladder[1]);
        g.fillStyle = rail;
        g.fillRect(px + rx, py, 3.5, T);
      }
      for (let ry = 4; ry < T; ry += 8) {
        g.fillStyle = th.ladder[1];
        g.fillRect(px + 9, py + ry + 1, 14, 3);
        g.fillStyle = th.ladder[0];
        g.fillRect(px + 9, py + ry, 14, 2);
      }
    } else if (c === "-") {
      g.strokeStyle = "rgba(0,0,0,0.6)";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(px, py + 6);
      g.lineTo(px + T, py + 6);
      g.stroke();
      g.strokeStyle = th.bar;
      g.lineWidth = 2.5;
      g.stroke();
      if (world === "moss") {
        g.strokeStyle = "rgba(90,60,25,0.8)";
        g.lineWidth = 1;
        for (let i = 0; i < T; i += 4) {
          g.beginPath();
          g.moveTo(px + i, py + 5);
          g.lineTo(px + i + 2, py + 7.5);
          g.stroke();
        }
      }
    }
  });

  ctx.save();
  if (shadow) ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 6;
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}

/** Items in their cells, then the actors. */
export function drawThings(ctx: Ctx, look: Look): void {
  eachCell((c, _x, _y, px, py) => {
    ctx.save();
    ctx.translate(px, py);
    drawItem(ctx, c, look);
    ctx.restore();
  });
  for (const a of ACTORS) {
    const [ax, ay] = actorOrigin(a);
    ctx.save();
    ctx.translate(ax, ay);
    if (!look.flat) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      if (a.pose === "run") ctx.ellipse(16, 31, 8, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawActor(ctx, a, look);
    ctx.restore();
  }
}

export function glowAt(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace("A", String(alpha)));
  g.addColorStop(1, color.replace("A", "0"));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}

/** Additive light: gold, the exit, portals, the lava, the runners' lamp. */
export function drawLights(ctx: Ctx, world: World, scale = 1): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  eachCell((c, _x, _y, px, py) => {
    const cx = px + T / 2;
    if (c === "$") glowAt(ctx, cx, py + 25, 30 * scale, "rgba(255,200,60,A)", 0.4);
    else if (c === "E") glowAt(ctx, cx, py + 18, 48 * scale, "rgba(255,230,150,A)", 0.45);
    else if (c === "T") glowAt(ctx, cx, py + 18, 34 * scale, "rgba(80,230,255,A)", 0.45);
    else if (c === "t") glowAt(ctx, cx, py + 18, 34 * scale, "rgba(200,120,255,A)", 0.45);
    else if (c === "~") glowAt(ctx, cx, py + 2, 18 * scale, "rgba(220,110,255,A)", 0.18);
  });
  for (const a of ACTORS) {
    if (a.kind === "runner1")
      glowAt(ctx, a.x * T + 24, a.y * T + 8, 22 * scale, "rgba(255,250,210,A)", 0.3);
    if (a.gold === true)
      glowAt(ctx, a.x * T + 10, a.y * T - 6, 22 * scale, "rgba(255,200,60,A)", 0.35);
  }
  if (world === "lava") {
    const g = ctx.createLinearGradient(0, PH - 120, 0, PH);
    g.addColorStop(0, "rgba(255,80,20,0)");
    g.addColorStop(1, "rgba(255,80,20,0.22)");
    ctx.fillStyle = g;
    ctx.fillRect(0, PH - 120, PW, 120);
  }
  ctx.restore();
  // Vignette.
  const v = ctx.createRadialGradient(PW / 2, PH / 2, PH * 0.45, PW / 2, PH / 2, PW * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, PW, PH);
}

function spiral(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 5; a += 0.15) {
    const rr = (r * a) / (Math.PI * 5);
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (a === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.strokeStyle = "#9aa0a8";
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function pad(n: number, w: number): string {
  return String(n).padStart(w, "0");
}

/** The riveted frame and the bottom status bar, one panel per player. */
export function drawFrame(ctx: Ctx): void {
  const metal = ctx.createLinearGradient(0, 0, 0, H);
  metal.addColorStop(0, "#4a4e55");
  metal.addColorStop(0.5, "#33363c");
  metal.addColorStop(1, "#23252a");
  ctx.fillStyle = metal;
  ctx.fillRect(0, 0, W, FRAME);
  ctx.fillRect(0, 0, FRAME, H);
  ctx.fillRect(W - FRAME, 0, FRAME, H);
  ctx.fillRect(0, FRAME + PH, W, H - FRAME - PH);
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 2;
  ctx.strokeRect(FRAME - 1, FRAME - 1, PW + 2, PH + 2);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.strokeRect(1, 1, W - 2, H - 2);
  // Rivets.
  const rivet = (x: number, y: number): void => {
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1b1e";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 0.6, y - 0.6, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = "#8a9099";
    ctx.fill();
  };
  for (let x = 24; x < W - 10; x += 40) rivet(x, FRAME / 2);
  for (let y = 40; y < FRAME + PH; y += 40) {
    rivet(FRAME / 2, y);
    rivet(W - FRAME / 2, y);
  }

  const by = FRAME + PH + 6;
  const bh = BAR - 6;
  const panel = (x: number, w: number): void => {
    ctx.beginPath();
    roundRect(ctx, x, by + 6, w, bh - 16, [5, 5, 5, 5]);
    ctx.fillStyle = "#0d0e11";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  ctx.textBaseline = "middle";
  const ty = by + 6 + (bh - 16) / 2;
  const players = [
    { x: 56, colors: ["#19b8d0", "#f1f4f6"] },
    { x: W - 56 - 330, colors: ["#c6b8ff", "#c6b8ff"] },
  ] as const;
  HUD.players.forEach((p, i) => {
    const pl = players[i];
    if (pl === undefined) return;
    const x = pl.x;
    panel(x, 80);
    panel(x + 90, 120);
    panel(x + 220, 44);
    panel(x + 274, 56);
    ctx.save();
    ctx.translate(x + 2, ty - 16);
    ctx.scale(0.9, 0.9);
    drawActor(
      ctx,
      { kind: i === 0 ? "runner1" : "runner2", x: 0, y: 0, pose: "run", facing: 1 },
      SHADED,
    );
    ctx.restore();
    ctx.font = "600 18px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillStyle = pl.colors[0];
    ctx.fillText(`×${String(p.lives)}`, x + 36, ty);
    ctx.fillStyle = "#ffc94d";
    ctx.fillText(pad(p.score, 7), x + 108, ty);
    ctx.save();
    ctx.translate(x + 226, ty - 16);
    drawItem(ctx, p.item, SHADED);
    ctx.restore();
    ctx.save();
    ctx.translate(x + 270, ty - 20);
    ctx.scale(0.8, 0.8);
    drawItem(ctx, "o", SHADED);
    ctx.restore();
    ctx.fillStyle = "#e6e9ee";
    ctx.fillText(String(p.bombs), x + 304, ty);
  });
  // The level number, between ornaments.
  const mid = W / 2;
  spiral(ctx, mid - 60, ty, 13);
  spiral(ctx, mid + 60, ty, 13);
  spiral(ctx, 26, ty, 13);
  spiral(ctx, W - 26, ty, 13);
  panel(mid - 36, 72);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffc94d";
  ctx.fillText(pad(HUD.level, 3), mid, ty);
  ctx.textAlign = "left";
}

export function renderDiorama(ctx: Ctx, world: World): void {
  drawFrame(ctx);
  ctx.save();
  ctx.translate(FRAME, FRAME);
  ctx.beginPath();
  ctx.rect(0, 0, PW, PH);
  ctx.clip();
  drawBackdrop(ctx, world);
  drawTerrain(ctx, world);
  drawThings(ctx, SHADED);
  drawLights(ctx, world);
  ctx.restore();
}
