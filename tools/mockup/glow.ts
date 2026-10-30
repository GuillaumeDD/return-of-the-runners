/**
 * B-030 direction 3, bold flat glow: dark backdrop, flat terrain with a neon rim, and
 * the items and actors as flat shapes with a halo.
 */
import { drawItem, drawActor, type Look } from "./art";
import { glowAt, pad } from "./diorama";
import {
  ACTORS,
  BAR,
  canvas,
  type Ctx,
  cell,
  COLS,
  eachCell,
  FRAME,
  H,
  HOLES,
  HUD,
  isHard,
  isSoft,
  prng,
  PH,
  PW,
  roundRect,
  ROWS,
  T,
  W,
  type World,
} from "./common";

const FLAT: Look = { flat: true };

const THEME: Readonly<
  Record<
    World,
    {
      bg: string;
      fill: string;
      rim: string;
      hard: string;
      hardRim: string;
      line: string;
      deco: string;
    }
  >
> = {
  moss: {
    bg: "#050d09",
    fill: "#0f2a1b",
    rim: "#39ff88",
    hard: "#141a20",
    hardRim: "#56657a",
    line: "#d9fff0",
    deco: "rgba(57,255,136,0.07)",
  },
  lava: {
    bg: "#0d0403",
    fill: "#2a0f08",
    rim: "#ff6a2a",
    hard: "#171416",
    hardRim: "#6a5a5e",
    line: "#ffe9dc",
    deco: "rgba(255,106,42,0.08)",
  },
};

/** A region mask: every cell where `pred` holds, with rounded outer corners. */
function mask(pred: (c: string) => boolean, color: string): HTMLCanvasElement {
  const [c, g] = canvas(PW, PH);
  g.fillStyle = color;
  const R = 7;
  eachCell((ch, x, y, px, py) => {
    if (!pred(ch)) return;
    const out = (dx: number, dy: number): boolean => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return false;
      return !pred(cell(nx, ny));
    };
    const up = out(0, -1);
    const down = out(0, 1);
    const left = out(-1, 0);
    const right = out(1, 0);
    g.beginPath();
    roundRect(g, px, py, T, T, [
      up && left ? R : 0,
      up && right ? R : 0,
      down && right ? R : 0,
      down && left ? R : 0,
    ]);
    g.fill();
  });
  return c;
}

/** The rim of a mask, `w` pixels wide: the mask minus its erosion. */
function rim(m: HTMLCanvasElement, w: number): HTMLCanvasElement {
  const [inner, g] = canvas(PW, PH);
  g.drawImage(m, 0, 0);
  g.globalCompositeOperation = "destination-in";
  for (const [dx, dy] of [
    [w, 0],
    [-w, 0],
    [0, w],
    [0, -w],
  ] as const) {
    g.drawImage(m, dx, dy);
  }
  const [e, eg] = canvas(PW, PH);
  eg.drawImage(m, 0, 0);
  eg.globalCompositeOperation = "destination-out";
  eg.drawImage(inner, 0, 0);
  return e;
}

export function renderGlow(ctx: Ctx, world: World): void {
  const th = THEME[world];
  ctx.fillStyle = "#030405";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(FRAME, FRAME);
  ctx.beginPath();
  ctx.rect(0, 0, PW, PH);
  ctx.clip();
  ctx.fillStyle = th.bg;
  ctx.fillRect(0, 0, PW, PH);
  // Backdrop: a dot grid and a few large outline shapes, barely there.
  ctx.fillStyle = th.deco;
  for (let y = 0; y < PH; y += 16) for (let x = 0; x < PW; x += 16) ctx.fillRect(x, y, 1.5, 1.5);
  const rnd = prng(world === "moss" ? 3 : 4);
  ctx.strokeStyle = th.deco;
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const x = rnd() * PW;
    const y = rnd() * PH;
    const r = 60 + rnd() * 160;
    ctx.beginPath();
    if (world === "moss") {
      ctx.moveTo(x - r, y);
      ctx.quadraticCurveTo(x, y - r * 0.5, x + r, y);
      ctx.quadraticCurveTo(x, y + r * 0.5, x - r, y);
      ctx.moveTo(x - r, y);
      ctx.lineTo(x + r, y);
    } else {
      ctx.moveTo(x - r, 0);
      ctx.lineTo(x, r * 0.8);
      ctx.lineTo(x + r * 0.4, 0);
    }
    ctx.stroke();
  }
  if (world === "lava") {
    const g = ctx.createLinearGradient(0, PH - 140, 0, PH);
    g.addColorStop(0, "rgba(255,90,30,0)");
    g.addColorStop(1, "rgba(255,90,30,0.25)");
    ctx.fillStyle = g;
    ctx.fillRect(0, PH - 140, PW, 140);
  }

  // Terrain: flat fills with a neon rim; bedrock gets a dim rim and hatching.
  const hard = mask(isHard, th.hard);
  ctx.drawImage(hard, 0, 0);
  ctx.save();
  ctx.beginPath();
  eachCell((c, _x, _y, px, py) => {
    if (isHard(c)) ctx.rect(px, py, T, T);
  });
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 2;
  for (let d = -PH; d < PW; d += 8) {
    ctx.beginPath();
    ctx.moveTo(d, PH);
    ctx.lineTo(d + PH, 0);
    ctx.stroke();
  }
  ctx.restore();
  const hardRim = rim(mask(isHard, th.hardRim), 2);
  ctx.drawImage(hardRim, 0, 0);

  const soft = mask(isSoft, th.fill);
  ctx.drawImage(soft, 0, 0);
  eachCell((c, _x, _y, px, py) => {
    if (!isSoft(c)) return;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(px + T / 2 - 2, py + T / 2 - 2, 4, 4);
  });
  const softRim = rim(mask(isSoft, th.rim), 2);
  ctx.save();
  ctx.shadowColor = th.rim;
  ctx.shadowBlur = 12;
  ctx.drawImage(softRim, 0, 0);
  ctx.restore();
  ctx.drawImage(softRim, 0, 0);

  // Gooey turf: a thick magenta band.
  eachCell((c, _x, _y, px, py) => {
    if (c !== "~") return;
    ctx.save();
    ctx.shadowColor = "#ff4fd8";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#ff4fd8";
    ctx.fillRect(px, py, T, 5);
    ctx.restore();
  });
  for (const [hx, hy] of HOLES) {
    ctx.strokeStyle = th.rim;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(hx * T + 2, hy * T + 1, T - 4, T - 2);
    ctx.setLineDash([]);
  }

  // Ladders and bars: thin light lines.
  ctx.save();
  ctx.shadowColor = th.line;
  ctx.shadowBlur = 6;
  ctx.strokeStyle = th.line;
  ctx.globalAlpha = 0.85;
  eachCell((c, _x, _y, px, py) => {
    if (c === "H") {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 8, py);
      ctx.lineTo(px + 8, py + T);
      ctx.moveTo(px + 24, py);
      ctx.lineTo(px + 24, py + T);
      for (let ry = 4; ry < T; ry += 8) {
        ctx.moveTo(px + 8, py + ry);
        ctx.lineTo(px + 24, py + ry);
      }
      ctx.stroke();
    } else if (c === "-") {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py + 6);
      ctx.lineTo(px + T, py + 6);
      ctx.stroke();
    }
  });
  ctx.restore();

  eachCell((c, _x, _y, px, py) => {
    ctx.save();
    ctx.translate(px, py);
    drawItem(ctx, c, FLAT);
    ctx.restore();
  });
  for (const a of ACTORS) {
    ctx.save();
    ctx.translate(a.x * T, a.y * T);
    drawActor(ctx, a, FLAT);
    ctx.restore();
  }
  ctx.globalCompositeOperation = "lighter";
  eachCell((c, _x, _y, px, py) => {
    if (c === "$") glowAt(ctx, px + 16, py + 25, 26, "rgba(255,210,60,A)", 0.35);
    if (c === "E") glowAt(ctx, px + 16, py + 18, 44, "rgba(255,240,180,A)", 0.4);
  });
  ctx.restore();

  // HUD: neon outlined panels.
  const by = FRAME + PH + 10;
  const bh = BAR - 20;
  ctx.font = "600 17px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const panel = (x: number, w: number, color: string): void => {
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, x, by, w, bh, [bh / 2, bh / 2, bh / 2, bh / 2]);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  };
  const ty = by + bh / 2;
  HUD.players.forEach((p, i) => {
    const color = i === 0 ? "#7ff3ff" : "#c6b8ff";
    const x = i === 0 ? FRAME : W - FRAME - 360;
    panel(x, 360, color);
    ctx.save();
    ctx.translate(x + 12, ty - 17);
    drawActor(
      ctx,
      { kind: i === 0 ? "runner1" : "runner2", x: 0, y: 0, pose: "run", facing: 1 },
      FLAT,
    );
    ctx.restore();
    ctx.fillStyle = color;
    ctx.fillText(`×${String(p.lives)}`, x + 46, ty);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(pad(p.score, 7), x + 100, ty);
    ctx.save();
    ctx.translate(x + 216, ty - 18);
    drawItem(ctx, p.item, FLAT);
    ctx.restore();
    ctx.save();
    ctx.translate(x + 270, ty - 20);
    ctx.scale(0.8, 0.8);
    drawItem(ctx, "o", FLAT);
    ctx.restore();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(p.bombs), x + 304, ty);
  });
  panel(W / 2 - 50, 100, "#ffd23a");
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd23a";
  ctx.fillText(pad(HUD.level, 3), W / 2, ty);
  ctx.textAlign = "left";
  // A thin rim around the playfield.
  ctx.save();
  ctx.strokeStyle = th.rim;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundRect(ctx, FRAME - 4, FRAME - 4, PW + 8, PH + 8, [8, 8, 8, 8]);
  ctx.stroke();
  ctx.restore();
}
