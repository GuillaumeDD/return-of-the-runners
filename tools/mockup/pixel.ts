/**
 * B-030 direction 1, neo-pixel: the scene is drawn at half resolution (16 px tiles),
 * snapped to a limited palette per world (ordered dithering on the backdrop, a dark
 * outline around sprites), scaled ×2 without smoothing, then lit with smooth light and
 * pixel sparks, which 1994 could not do.
 */
import { drawBackdrop, drawFrame, drawLights, drawTerrain, drawThings } from "./diorama";
import {
  canvas,
  type Ctx,
  FRAME,
  H,
  hex,
  PH,
  prng,
  PW,
  type RGB,
  W,
  type World,
  ACTORS,
  eachCell,
} from "./common";

const SHARED = [
  "#120a06",
  "#ffffff",
  "#f1f4f6",
  "#9aa6b2",
  "#19b8d0",
  "#c6b8ff",
  "#7a64d6",
  "#5b3fb8",
  "#ff6fae",
  "#f2c9a0",
  "#d42a2a",
  "#7a1010",
  "#ffe36b",
  "#fff6b0",
  "#ffcc1a",
  "#c98a00",
  "#e8443a",
  "#3fbf4a",
  "#3a7be8",
  "#4fe6ff",
  "#c77dff",
  "#c35bd6",
  "#f0a3ff",
  "#6e1f86",
  "#8a5a2b",
  "#b8834a",
  "#6b4220",
  "#aeb6bf",
  "#4b525a",
  "#3a3d44",
  "#8a8f99",
  "#d8c49a",
  "#0d0e11",
  "#23252a",
  "#33363c",
  "#4a4e55",
  "#f2b705",
  "#6a9a50",
];

const WORLD_COLORS: Readonly<Record<World, readonly string[]>> = {
  moss: [
    "#08140d",
    "#0b1c12",
    "#122818",
    "#183323",
    "#204029",
    "#2a4a30",
    "#2f6b25",
    "#47892f",
    "#5ea83a",
    "#86c452",
    "#a6d867",
    "#c8f27a",
    "#4a5552",
    "#6f7a7c",
    "#8a9690",
    "#b9c2c4",
  ],
  lava: [
    "#120302",
    "#1a0503",
    "#2a0a06",
    "#3a0f08",
    "#5a1a0c",
    "#8a3a14",
    "#a8200c",
    "#cc6a2c",
    "#e08a3c",
    "#f2a35e",
    "#ffd9a0",
    "#ff7a1f",
    "#ffd36b",
    "#2a2526",
    "#5a4f4e",
    "#7a6c6a",
  ],
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function nearest(pal: readonly RGB[], r: number, g: number, b: number): RGB {
  let best: RGB = pal[0] ?? [0, 0, 0];
  let bd = Infinity;
  for (const p of pal) {
    // Weighted distance: the eye is most sensitive to green.
    const d = 3 * (p[0] - r) ** 2 + 4 * (p[1] - g) ** 2 + 2 * (p[2] - b) ** 2;
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

/** Snaps a layer to the palette; `dither` adds ordered noise, `sprite` cuts alpha and outlines. */
function quantize(
  c: HTMLCanvasElement,
  pal: readonly RGB[],
  dither: number,
  sprite: boolean,
): void {
  const g = c.getContext("2d");
  if (g === null) return;
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const w = c.width;
  for (let i = 0; i < d.length; i += 4) {
    const p = i / 4;
    const t = ((BAYER[((p % w) % 4) + (Math.floor(p / w) % 4) * 4] ?? 0) / 16 - 0.5) * dither;
    const a = d[i + 3] ?? 0;
    if (sprite && a < 110) {
      d[i + 3] = 0;
      continue;
    }
    const [r, gg, b] = nearest(pal, (d[i] ?? 0) + t, (d[i + 1] ?? 0) + t, (d[i + 2] ?? 0) + t);
    d[i] = r;
    d[i + 1] = gg;
    d[i + 2] = b;
    d[i + 3] = 255;
  }
  if (sprite) {
    const opaque = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < w && y < c.height && (d[(y * w + x) * 4 + 3] ?? 0) === 255;
    const edge: number[] = [];
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < w; x++) {
        if (opaque(x, y)) continue;
        if (opaque(x + 1, y) || opaque(x - 1, y) || opaque(x, y + 1) || opaque(x, y - 1))
          edge.push((y * w + x) * 4);
      }
    }
    for (const i of edge) {
      d[i] = 18;
      d[i + 1] = 10;
      d[i + 2] = 6;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

export function renderPixel(ctx: Ctx, world: World): void {
  const pal = [...SHARED, ...WORLD_COLORS[world]].map(hex);
  const half = (draw: (g: Ctx) => void, w: number, h: number): HTMLCanvasElement => {
    const [c, g] = canvas(w / 2, h / 2);
    g.scale(0.5, 0.5);
    draw(g);
    return c;
  };
  const frame = half(drawFrame, W, H);
  quantize(frame, pal, 0, false);
  const back = half(
    (g) => {
      drawBackdrop(g, world);
    },
    PW,
    PH,
  );
  quantize(back, pal, 40, false);
  const fore = half(
    (g) => {
      drawTerrain(g, world, false);
      drawThings(g, { flat: false });
    },
    PW,
    PH,
  );
  quantize(fore, pal, 0, true);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(frame, 0, 0, W, H);
  ctx.save();
  ctx.translate(FRAME, FRAME);
  ctx.beginPath();
  ctx.rect(0, 0, PW, PH);
  ctx.clip();
  ctx.drawImage(back, 0, 0, PW, PH);
  // A hard pixel shadow under the terrain, then the terrain.
  ctx.globalAlpha = 0.45;
  ctx.filter = "brightness(0)";
  ctx.drawImage(fore, 4, 4, PW, PH);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.drawImage(fore, 0, 0, PW, PH);
  drawLights(ctx, world);
  // Pixel sparks: a 2 × 2 grid, so they sit on the art's pixels.
  const rnd = prng(world === "moss" ? 71 : 73);
  ctx.globalCompositeOperation = "lighter";
  eachCell((c, _x, _y, px, py) => {
    if (c !== "$") return;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#fff6b0" : "#ffcc1a";
      const sx = px + Math.floor(rnd() * 14) * 2 + 2;
      const sy = py + 8 + Math.floor(rnd() * 8) * 2;
      ctx.fillRect(sx, sy, 2, 2);
      if (i === 0) {
        ctx.fillRect(sx - 2, sy, 6, 2);
        ctx.fillRect(sx, sy - 2, 2, 6);
      }
    }
  });
  const runner = ACTORS[0];
  if (runner !== undefined && world === "moss") {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = "rgba(200,255,150,0.7)";
      ctx.fillRect(Math.floor((rnd() * PW) / 2) * 2, Math.floor((rnd() * PH) / 2) * 2, 2, 2);
    }
  }
  if (world === "lava") {
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = i % 3 === 0 ? "#ffd36b" : "#ff7a1f";
      ctx.fillRect(
        Math.floor((rnd() * PW) / 2) * 2,
        Math.floor((PH * 0.35 + rnd() * PH * 0.65) / 2) * 2,
        2,
        2,
      );
    }
  }
  ctx.restore();
}
