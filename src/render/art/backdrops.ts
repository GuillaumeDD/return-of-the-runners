/**
 * The painted backdrop of each world (ARCHITECTURE § Art direction): a scene behind the
 * grid, calm and dim so the terrain stays loud. Painted once per world, night and size
 * (`render/backdrop.ts` keeps them), from seeded noise: the same picture at every load.
 * Night darkens the scene and lets its small lights shine. All _provisional_ (B-045).
 */
import type { World } from "../../level/format";
import { fbm, prng } from "./noise";
import { WORLD_ART, type WorldArt } from "./worlds";

type Ctx = CanvasRenderingContext2D;

const TAU = Math.PI * 2;

/** How much the finished scene is dimmed, by day and by night (style guide: 25 %). */
export const DIM = { day: 0.25, night: 0.5 } as const;

/** Worlds under an open sky, which get stars by night. */
const OPEN_SKY: ReadonlySet<World> = new Set(["moss", "ancient", "ice", "fossil"]);

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** `a` mixed toward `b` by `t` (0 to 1), as `rgba()` with alpha `alpha`. */
export function mix(a: string, b: string, t: number, alpha = 1): string {
  const ca = channels(a);
  const cb = channels(b);
  const c = ca.map((v, i) => Math.round(v + ((cb[i] ?? v) - v) * t));
  return `rgba(${c.join(",")},${String(alpha)})`;
}

/** The far and near silhouette colours of a world: its sky tinted by its rock. */
function inks(art: WorldArt): { far: string; near: string } {
  return {
    far: mix(art.day[0], art.soft[0], 0.4),
    near: mix(art.day[1], art.soft[0], 0.5),
  };
}

/** A noisy skyline across the scene, from the bottom (or hanging from the top). */
function ridge(
  ctx: Ctx,
  w: number,
  h: number,
  base: number,
  amp: number,
  scale: number,
  seed: number,
  color: string,
  fromTop = false,
): void {
  ctx.beginPath();
  ctx.moveTo(0, fromTop ? 0 : h);
  for (let x = 0; x <= w; x += 4) {
    const n = fbm(x / scale, 0.5, seed, 5);
    ctx.lineTo(x, fromTop ? base + n * amp : base - n * amp);
  }
  ctx.lineTo(w, fromTop ? 0 : h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** A row of spikes: stalactites or icicles from the top, spires from the bottom. */
function spikes(
  ctx: Ctx,
  w: number,
  h: number,
  fromTop: boolean,
  step: number,
  length: number,
  seed: number,
  color: string,
): void {
  const rnd = prng(seed);
  ctx.fillStyle = color;
  ctx.beginPath();
  const edge = fromTop ? 0 : h;
  ctx.moveTo(0, edge);
  for (let x = 0; x < w; x += step) {
    const l = length * (0.25 + rnd() * 0.75);
    ctx.lineTo(x + step * 0.15, edge);
    ctx.lineTo(x + step * 0.5, fromTop ? l : h - l);
    ctx.lineTo(x + step * 0.85, edge);
  }
  ctx.lineTo(w, edge);
  ctx.closePath();
  ctx.fill();
}

/** Small soft lights scattered over the scene. */
function motes(
  ctx: Ctx,
  w: number,
  h: number,
  count: number,
  radius: number,
  color: string,
  seed: number,
  alpha: number,
  top = 0,
): void {
  const rnd = prng(seed);
  for (let i = 0; i < count; i++) {
    const x = rnd() * w;
    const y = top + rnd() * (h - top);
    const r = radius * (0.5 + rnd() * 0.8);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, mix(color, color, 0, alpha));
    g.addColorStop(1, mix(color, color, 0, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function moss(ctx: Ctx, w: number, h: number, art: WorldArt): void {
  const { far, near } = inks(art);
  // Light shafts through the canopy.
  for (const f of [0.2, 0.5, 0.78]) {
    const sx = f * w;
    const g = ctx.createLinearGradient(sx, 0, sx - h * 0.4, h);
    g.addColorStop(0, "rgba(210,255,170,0.10)");
    g.addColorStop(1, "rgba(210,255,170,0)");
    ctx.beginPath();
    ctx.moveTo(sx - 30, 0);
    ctx.lineTo(sx + 30, 0);
    ctx.lineTo(sx - h * 0.3, h);
    ctx.lineTo(sx - h * 0.6, h);
    ctx.fillStyle = g;
    ctx.fill();
  }
  ridge(ctx, w, h, h * 0.62, h * 0.4, 160, 3, far);
  // Tree trunks.
  for (const [f, tw] of [
    [0.08, 40],
    [0.36, 26],
    [0.66, 46],
    [0.9, 30],
  ] as const) {
    const tx = f * w;
    ctx.fillStyle = near;
    ctx.beginPath();
    ctx.moveTo(tx, 0);
    ctx.bezierCurveTo(tx - 10, h * 0.4, tx + 14, h * 0.7, tx - 16, h);
    ctx.lineTo(tx + tw + 18, h);
    ctx.bezierCurveTo(tx + tw + 6, h * 0.7, tx + tw - 6, h * 0.4, tx + tw, 0);
    ctx.fill();
  }
  ridge(ctx, w, h, h * 0.88, h * 0.16, 90, 5, near);
  // Hanging vines.
  const rnd = prng(19);
  ctx.lineCap = "round";
  ctx.strokeStyle = mix(art.soft[0], art.day[0], 0.4, 0.55);
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 12; i++) {
    const x = rnd() * w;
    const len = h * (0.15 + rnd() * 0.4);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 20, len * 0.3, x - 20, len * 0.6, x + 6, len);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

function fungus(ctx: Ctx, w: number, h: number, art: WorldArt): void {
  const { far, near } = inks(art);
  ridge(ctx, w, h, h * 0.7, h * 0.3, 140, 21, far);
  // Giant mushrooms: a curved stem under a wide cap, with gills.
  const rnd = prng(23);
  for (let i = 0; i < 5; i++) {
    const x = (i + 0.3 + rnd() * 0.4) * (w / 5);
    const top = h * (0.25 + rnd() * 0.3);
    const r = 30 + rnd() * 40;
    ctx.fillStyle = near;
    ctx.beginPath();
    ctx.moveTo(x - 6, h);
    ctx.quadraticCurveTo(x + 10, (top + h) / 2, x - 3, top);
    ctx.lineTo(x + 5, top);
    ctx.quadraticCurveTo(x + 18, (top + h) / 2, x + 8, h);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 1, top, r, r * 0.45, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = mix(art.soft[1], art.day[1], 0.5, 0.5);
    ctx.fillRect(x + 1 - r * 0.9, top - 1, r * 1.8, 3);
  }
  ridge(ctx, w, h, h * 0.92, h * 0.12, 70, 25, near);
}

function ancient(ctx: Ctx, w: number, h: number, art: WorldArt): void {
  const { far, near } = inks(art);
  ridge(ctx, w, h, h * 0.75, h * 0.25, 180, 31, far);
  // Ruined columns, some broken, on a long stylobate.
  const rnd = prng(33);
  const base = h * 0.86;
  ctx.fillStyle = near;
  ctx.fillRect(0, base, w, h - base);
  for (let i = 0; i < 7; i++) {
    const x = (i + 0.5) * (w / 7) - 12;
    const broken = rnd() < 0.35;
    const top = broken ? h * (0.45 + rnd() * 0.25) : h * 0.18;
    ctx.fillRect(x, top, 24, base - top);
    if (!broken) {
      ctx.fillRect(x - 6, top - 8, 36, 8);
      ctx.fillRect(x - 3, top, 30, 4);
    }
    // Flutes.
    ctx.fillStyle = mix(art.day[0], art.soft[2], 0.25, 0.35);
    for (const dx of [6, 12, 18]) ctx.fillRect(x + dx, top + 6, 1.5, base - top - 8);
    ctx.fillStyle = near;
  }
  // An architrave over the standing ones.
  ctx.fillRect(0, h * 0.18 - 16, w, 8);
}

function crystal(ctx: Ctx, w: number, h: number, art: WorldArt): void {
  const { far, near } = inks(art);
  spikes(ctx, w, h, true, 34, h * 0.28, 41, far);
  // Crystal spires from the floor, each with a lit facet.
  const rnd = prng(43);
  for (let i = 0; i < 14; i++) {
    const x = rnd() * w;
    const tall = h * (0.2 + rnd() * 0.45);
    const half = 10 + rnd() * 16;
    const lean = (rnd() - 0.5) * 30;
    ctx.fillStyle = near;
    ctx.beginPath();
    ctx.moveTo(x - half, h);
    ctx.lineTo(x - half * 0.6 + lean, h - tall * 0.85);
    ctx.lineTo(x + lean, h - tall);
    ctx.lineTo(x + half * 0.6 + lean, h - tall * 0.85);
    ctx.lineTo(x + half, h);
    ctx.fill();
    ctx.fillStyle = mix(art.soft[3], art.day[0], 0.55, 0.35);
    ctx.beginPath();
    ctx.moveTo(x - half, h);
    ctx.lineTo(x - half * 0.6 + lean, h - tall * 0.85);
    ctx.lineTo(x + lean, h - tall);
    ctx.lineTo(x, h);
    ctx.fill();
  }
}

function ice(ctx: Ctx, w: number, h: number, art: WorldArt): void {
  const { far, near } = inks(art);
  ridge(ctx, w, h, h * 0.66, h * 0.35, 120, 51, far);
  // Snow on the far peaks: the same skyline, uncovered by a lower copy.
  ridge(ctx, w, h, h * 0.66, h * 0.35, 120, 51, mix(art.top[0], art.day[0], 0.6, 0.25));
  ridge(ctx, w, h, h * 0.7, h * 0.35, 120, 51, far);
  spikes(ctx, w, h, true, 22, h * 0.2, 53, mix(art.soft[3], art.day[0], 0.5, 0.6));
  ridge(ctx, w, h, h * 0.92, h * 0.14, 80, 55, near);
}

function fossil(ctx: Ctx, w: number, h: number, art: WorldArt): void {
  const { far, near } = inks(art);
  ridge(ctx, w, h, h * 0.72, h * 0.3, 150, 61, far);
  // A giant ribcage half buried in the dunes: a spine and its arching ribs.
  const cx = w * 0.55;
  const cy = h * 0.8;
  ctx.strokeStyle = mix(art.top[0], art.day[0], 0.55, 0.6);
  ctx.lineCap = "round";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.3, cy);
  ctx.quadraticCurveTo(cx, cy - h * 0.18, cx + w * 0.3, cy);
  ctx.stroke();
  ctx.lineWidth = 5;
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.5) / 8;
    const x = cx - w * 0.3 + t * w * 0.6;
    const y = cy - h * 0.18 * 4 * t * (1 - t) * 0.5;
    const r = h * (0.3 - Math.abs(t - 0.5) * 0.3);
    ctx.beginPath();
    ctx.arc(x + r * 0.35, y, r, Math.PI * 1.05, Math.PI * 1.6);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  ridge(ctx, w, h, h * 0.94, h * 0.14, 90, 65, near);
}

function lava(ctx: Ctx, w: number, h: number, art: WorldArt): void {
  const { far, near } = inks(art);
  ridge(ctx, w, h, h * 0.5, h * 0.4, 200, 7, far);
  spikes(ctx, w, h, true, 18, h * 0.22, 9, near);
  ridge(ctx, w, h, h * 0.9, h * 0.18, 70, 13, near);
  // The lava river and its glow.
  const glow = ctx.createLinearGradient(0, h * 0.6, 0, h);
  glow.addColorStop(0, "rgba(255,90,20,0)");
  glow.addColorStop(1, "rgba(255,110,30,0.45)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, h * 0.6, w, h * 0.4);
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 6) ctx.lineTo(x, h - 30 + Math.round(fbm(x / 50, 3, 17, 3) * 16));
  ctx.lineTo(w, h);
  const river = ctx.createLinearGradient(0, h - 32, 0, h);
  river.addColorStop(0, "#ffd36b");
  river.addColorStop(0.35, "#ff7a1f");
  river.addColorStop(1, "#a8200c");
  ctx.fillStyle = river;
  ctx.fill();
}

function phosphorus(ctx: Ctx, w: number, h: number, art: WorldArt): void {
  const { far, near } = inks(art);
  ridge(ctx, w, h, h * 0.62, h * 0.35, 130, 71, far);
  ridge(ctx, w, h, h * 0.12, h * 0.18, 60, 73, near, true);
  // Glowing threads hanging from the roof, each ending in a bead.
  const rnd = prng(75);
  ctx.strokeStyle = mix(art.glow, art.day[0], 0.6, 0.45);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 26; i++) {
    const x = rnd() * w;
    const len = h * (0.12 + rnd() * 0.35);
    ctx.beginPath();
    ctx.moveTo(x, h * 0.1);
    ctx.lineTo(x, len);
    ctx.stroke();
    motesAt(ctx, x, len, 5, art.glow, 0.55);
  }
  ridge(ctx, w, h, h * 0.92, h * 0.12, 70, 77, near);
}

function dark(ctx: Ctx, w: number, h: number, art: WorldArt): void {
  const { far, near } = inks(art);
  ridge(ctx, w, h, h * 0.7, h * 0.3, 170, 81, far);
  spikes(ctx, w, h, true, 40, h * 0.25, 83, near);
  ridge(ctx, w, h, h * 0.93, h * 0.12, 80, 85, near);
}

function industrial(ctx: Ctx, w: number, h: number, art: WorldArt): void {
  const { far, near } = inks(art);
  // Girders with cross bracing.
  ctx.strokeStyle = far;
  ctx.fillStyle = far;
  for (let i = 0; i < 5; i++) {
    const x = (i + 0.5) * (w / 5) - 10;
    ctx.fillRect(x, 0, 20, h);
  }
  ctx.lineWidth = 4;
  for (let i = 0; i < 4; i++) {
    const x0 = (i + 0.5) * (w / 5);
    const x1 = (i + 1.5) * (w / 5);
    for (let y = 0; y < h; y += h / 3) {
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y + h / 3);
      ctx.moveTo(x1, y);
      ctx.lineTo(x0, y + h / 3);
      ctx.stroke();
    }
  }
  // Pipes across the scene.
  ctx.strokeStyle = near;
  ctx.lineCap = "round";
  for (const [f, width] of [
    [0.22, 14],
    [0.58, 10],
    [0.8, 18],
  ] as const) {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(0, h * f);
    ctx.lineTo(w, h * f);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  // A big gear.
  const gx = w * 0.72;
  const gy = h * 0.45;
  const r = h * 0.2;
  ctx.fillStyle = near;
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    const rr = i % 2 === 0 ? r : r * 1.15;
    ctx.lineTo(gx + rr * Math.cos(a), gy + rr * Math.sin(a));
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = far;
  ctx.beginPath();
  ctx.arc(gx, gy, r * 0.35, 0, TAU);
  ctx.fill();
}

/** One soft light at a point. */
function motesAt(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, mix(color, color, 0, alpha));
  g.addColorStop(1, mix(color, color, 0, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const SCENES: Readonly<Record<World, (ctx: Ctx, w: number, h: number, art: WorldArt) => void>> = {
  moss,
  fungus,
  ancient,
  crystal,
  ice,
  fossil,
  lava,
  phosphorus,
  dark,
  industrial,
};

/** How many small lights each world scatters, and how big they are. */
const LIGHTS: Readonly<Record<World, { count: number; radius: number }>> = {
  moss: { count: 18, radius: 7 },
  fungus: { count: 30, radius: 5 },
  ancient: { count: 24, radius: 3 },
  crystal: { count: 22, radius: 5 },
  ice: { count: 40, radius: 3 },
  fossil: { count: 20, radius: 3 },
  lava: { count: 40, radius: 3 },
  phosphorus: { count: 24, radius: 6 },
  dark: { count: 8, radius: 4 },
  industrial: { count: 6, radius: 14 },
};

/**
 * Paints `world`'s backdrop over `w` × `h` logical pixels: its sky gradient, its scene,
 * the dimming, then its small lights (brighter by night), and stars under an open sky.
 */
export function paintBackdrop(ctx: Ctx, w: number, h: number, world: World, night: boolean): void {
  const art = WORLD_ART[world];
  const [top, bottom] = art[night ? "night" : "day"];
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, top);
  sky.addColorStop(1, bottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  if (night && OPEN_SKY.has(world)) motes(ctx, w, h * 0.5, 40, 1.6, "#ffffff", 97, 0.8);
  ctx.save();
  SCENES[world](ctx, w, h, art);
  ctx.restore();
  ctx.fillStyle = `rgba(0,0,0,${String(night ? DIM.night : DIM.day)})`;
  ctx.fillRect(0, 0, w, h);
  const { count, radius } = LIGHTS[world];
  motes(ctx, w, h, count, radius, art.glow, 91, night ? 0.85 : 0.45, h * 0.1);
}
