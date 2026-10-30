import { DOOR_KEY, TILE, type Teleport } from "../level/format";
import { blastCells, type Blast, type Fuse } from "../sim/bombs";
import { craterAt, holeAt, holePhase } from "../sim/holes";
import { BLAST_TICKS, HOLE_TICKS, SUB } from "../sim/rules";
import type { GameState, Monk, Player } from "../sim/state";
import type { Cloud } from "../sim/gas";
import type { Snare } from "../sim/snares";
import type { Rubble } from "../sim/tools";

/** On-screen size of one tile, in canvas pixels. A multiple of SUB keeps motion crisp. */
export const TILE_PX = 24;
const PX_PER_SUB = TILE_PX / SUB;

// Placeholder palette: real art comes later, with ASSETS.md entries.
const COLOR = {
  background: "#111",
  brick: "#a0522d",
  mortar: "#5a2e19",
  bedrock: "#555",
  ladder: "#d9b36c",
  bar: "#cfcfcf",
  gold: "#f2c94c",
  exitLocked: "#666",
  exitOpen: "#4caf50",
  runner: "#f5f5f5",
  runnerFace: "#3a7bd5",
  runner2: "#7fd8f0",
  runner2Face: "#1b3f8f",
  runnerDead: "#d64545",
  runnerHidden: "#5a5470",
  runnerHiddenFace: "#8f88a8",
  monk: "#e07b39",
  monkFace: "#2b1a0e",
  goo: "#4f8f3a",
  gooDrip: "#2f5e22",
  alcove: "#3a2d4d",
  alcoveInside: "#0a0710",
  hiddenLadder: "#6b5a36",
  trapdoorMark: "#f2e6a0",
  teleportIn: "#f2c94c",
  teleportOut: "#7fd8f0",
  sparkle: "#fff6c8",
  link: "#7fd8f0",
  keyRed: "#e5484d",
  keyGreen: "#46a758",
  keyBlue: "#3e63dd",
  keyhole: "#111",
  steel: "#b8c0cc",
  steelDark: "#5d6673",
  handle: "#8b5a2b",
  rubble: "#8a7866",
  rubbleDark: "#4e4237",
  bomb: "#2b2b33",
  bombShine: "#6b6b7a",
  bombBigRing: "#c9a227",
  fuse: "#d9b36c",
  spark: "#ffd84a",
  blast: "#ff7a2f",
  blastBig: "#ffe38a",
  rope: "#c8a165",
  ropeDark: "#7a5a2e",
  gun: "#3f7f5f",
  gunTank: "#9fdc8a",
  bucket: "#8a8f99",
  bucketRim: "#c5cad3",
  // Translucent, so what is in the cloud still shows through.
  gas: "rgba(120, 210, 110, 0.45)",
  gasThin: "rgba(120, 210, 110, 0.22)",
  daze: "#ffd84a",
  gridLine: "#222",
} as const;

/** The 2D context of a canvas; throws when the browser has none. */
export function context2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = c.getContext("2d");
  if (!context) throw new Error("Canvas 2D is not available");
  return context;
}

export function canvasSize(state: Pick<GameState, "width" | "height">): {
  width: number;
  height: number;
} {
  return { width: state.width * TILE_PX, height: state.height * TILE_PX };
}

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = canvasSize(state);
  ctx.fillStyle = COLOR.background;
  ctx.fillRect(0, 0, width, height);

  const exitOpen = state.goldLeft === 0;
  drawTiles(state.tiles, (tile, cx, cy, x, y) => {
    const hole = holeAt(state.holes, cx, cy);
    const crater = craterAt(state.craters, cx, cy);
    if (crater !== undefined) drawHole(ctx, tile, craterLeft(crater.left), x, y);
    else if (hole === undefined) drawTile(ctx, tile, x, y, exitOpen);
    else drawHole(ctx, tile, brickLeft(hole.age), x, y);
  });
  for (const r of state.rubble) drawRubble(ctx, r);
  for (const n of state.snares) drawArmedSnare(ctx, n);
  for (const f of state.fuses) drawLitBomb(ctx, f);
  for (const m of state.monks) drawMonk(ctx, m, state.tick);
  // Actors in a teleporter show as a sparkle at the exit.
  for (const a of [...state.monks, ...state.players]) {
    if (a.warp > 0) drawSparkle(ctx, a.x * PX_PER_SUB, a.y * PX_PER_SUB);
  }
  state.players.forEach((p, i) => {
    drawPlayer(ctx, p, i, state.status === "dead");
  });
  for (const c of state.clouds) drawCloud(ctx, c);
  for (const b of state.blasts) drawBlast(ctx, b, state.width, state.height);
}

/** An armed snare: a loop of rope lying open on the floor. */
function drawArmedSnare(ctx: CanvasRenderingContext2D, n: Snare): void {
  const x = n.cx * TILE_PX;
  const y = n.cy * TILE_PX;
  const s = TILE_PX;
  ctx.fillStyle = COLOR.rope;
  ctx.fillRect(x + 3, y + s - 3, s - 6, 2);
  ctx.fillRect(x + 3, y + s - 6, 2, 3);
  ctx.fillRect(x + s - 5, y + s - 6, 2, 3);
  ctx.fillStyle = COLOR.ropeDark;
  ctx.fillRect(x + s / 2 - 1, y + s - 8, 2, 5);
}

/** A gas cloud over its cells; it thins out over its last ticks. */
function drawCloud(ctx: CanvasRenderingContext2D, c: Cloud): void {
  ctx.fillStyle = c.left > TICKS_FADING ? COLOR.gas : COLOR.gasThin;
  for (let i = 0; i < c.width; i++) {
    const x = (c.cx + i) * TILE_PX;
    const y = c.cy * TILE_PX;
    ctx.fillRect(x, y + 3, TILE_PX, TILE_PX - 5);
    ctx.fillRect(x + 3, y + 1, TILE_PX - 6, TILE_PX - 1);
  }
}

/** Ticks before a cloud is gone when it starts to look thin (drawing only). */
const TICKS_FADING = 60;

/**
 * How much of a blown-away brick is visible: none while the crater is open, then it
 * grows back over the last `HOLE_TICKS.closing` ticks, as a hole does.
 */
export function craterLeft(left: number): number {
  return Math.min(1, Math.max(0, 1 - left / HOLE_TICKS.closing));
}

/** A bomb lying in a cell: a round body with a fuse; a big one is larger, with a ring. */
function drawBomb(ctx: CanvasRenderingContext2D, x: number, y: number, big: boolean): void {
  const s = TILE_PX;
  const r = big ? 9 : 6; // half the body's width
  const cx = x + s / 2;
  const bottom = y + s - 1;
  ctx.fillStyle = COLOR.bomb;
  ctx.fillRect(cx - r, bottom - 2 * r + 2, 2 * r, 2 * r - 4);
  ctx.fillRect(cx - r + 2, bottom - 2 * r, 2 * r - 4, 2 * r);
  ctx.fillStyle = COLOR.bombShine;
  ctx.fillRect(cx - r + 3, bottom - 2 * r + 3, 3, 3);
  if (big) {
    ctx.fillStyle = COLOR.bombBigRing;
    ctx.fillRect(cx - r, bottom - r - 1, 2 * r, 2);
  }
  ctx.fillStyle = COLOR.fuse;
  ctx.fillRect(cx + 1, bottom - 2 * r - 4, 2, 4);
}

/** A lit bomb: as it lies, with a spark on its fuse that flickers as it burns. */
function drawLitBomb(ctx: CanvasRenderingContext2D, f: Fuse): void {
  const x = f.cx * TILE_PX;
  const y = f.cy * TILE_PX;
  drawBomb(ctx, x, y, f.big);
  const r = f.big ? 9 : 6;
  ctx.fillStyle = COLOR.spark;
  const size = (f.left >> 3) % 2 === 0 ? 4 : 2;
  ctx.fillRect(x + TILE_PX / 2 + 2 - size / 2, y + TILE_PX - 1 - 2 * r - 4 - size, size, size);
}

/** A blast: every cell it covers is lit up, fading as it ages. */
function drawBlast(ctx: CanvasRenderingContext2D, b: Blast, width: number, height: number): void {
  const inset = Math.floor((b.age * (TILE_PX / 2)) / BLAST_TICKS);
  ctx.fillStyle = b.big ? COLOR.blastBig : COLOR.blast;
  for (const c of blastCells(b.cx, b.cy, b.big, width, height)) {
    ctx.fillRect(
      c.cx * TILE_PX + inset,
      c.cy * TILE_PX + inset,
      TILE_PX - 2 * inset,
      TILE_PX - 2 * inset,
    );
  }
}

/**
 * A player: red while dead (waiting to reappear), a dim shadow while hiding in an
 * alcove; a player who is out is not drawn, unless the level is lost, when everyone
 * shows where they fell. The item it holds is drawn small, in its hand.
 */
function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, index: number, lost: boolean): void {
  if ((p.mode === "out" && !lost) || p.warp > 0) return;
  const dead = p.mode !== "alive";
  const x = p.x * PX_PER_SUB;
  const y = p.y * PX_PER_SUB;
  drawRunner(ctx, x, y, p.facing, dead, index, p.hidden);
  const hand = p.facing === 1 ? x + 17 : x + 1;
  const color = KEY_COLOR[p.item];
  if (color !== undefined) {
    ctx.fillStyle = color;
    ctx.fillRect(hand, y + 10, 6, 2); // shaft
    ctx.fillRect(p.facing === 1 ? hand + 4 : hand, y + 8, 2, 6); // bow
  } else if (p.item === TILE.jackhammer) {
    ctx.fillStyle = COLOR.steelDark;
    ctx.fillRect(hand, y + 8, 6, 2); // handle
    ctx.fillStyle = COLOR.steel;
    ctx.fillRect(hand + 2, y + 10, 2, 5); // body
    ctx.fillRect(hand + 2, y + 15, 1, 3); // bit
  } else if (p.item === TILE.pickaxe) {
    ctx.fillStyle = COLOR.handle;
    ctx.fillRect(hand + 2, y + 9, 2, 8); // handle
    ctx.fillStyle = COLOR.steel;
    ctx.fillRect(hand, y + 8, 6, 2); // head
  } else if (p.item === TILE.snare) {
    ctx.fillStyle = COLOR.rope;
    ctx.fillRect(hand, y + 9, 6, 2); // coil
    ctx.fillRect(hand, y + 13, 6, 2);
    ctx.fillRect(hand, y + 9, 2, 6);
    ctx.fillRect(hand + 4, y + 9, 2, 6);
  } else if (p.item === TILE.gasSpray) {
    ctx.fillStyle = COLOR.gun;
    ctx.fillRect(hand, y + 10, 6, 3); // barrel
    ctx.fillStyle = COLOR.gunTank;
    ctx.fillRect(p.facing === 1 ? hand : hand + 3, y + 7, 3, 3); // tank
  } else if (p.item === TILE.gooBucket) {
    ctx.fillStyle = COLOR.bucket;
    ctx.fillRect(hand, y + 10, 6, 5); // pail
    ctx.fillStyle = COLOR.goo;
    ctx.fillRect(hand + 1, y + 10, 4, 2); // goo
  }
}

/** Rubble: a heap of stones, where it is (falling rubble is drawn between cells). */
function drawRubble(ctx: CanvasRenderingContext2D, r: Rubble): void {
  const x = r.cx * TILE_PX;
  const y = r.y * PX_PER_SUB;
  ctx.fillStyle = COLOR.rubbleDark;
  ctx.fillRect(x + 1, y + 1, TILE_PX - 2, TILE_PX - 1);
  ctx.fillStyle = COLOR.rubble;
  ctx.fillRect(x + 2, y + 2, 9, 6);
  ctx.fillRect(x + 13, y + 3, 9, 7);
  ctx.fillRect(x + 3, y + 10, 7, 6);
  ctx.fillRect(x + 12, y + 12, 10, 5);
  ctx.fillRect(x + 2, y + 18, 11, 5);
  ctx.fillRect(x + 15, y + 19, 7, 4);
}

/** The colour of each key; a door has the colour of its key (`DOOR_KEY`). */
const KEY_COLOR: Readonly<Record<string, string>> = {
  [TILE.keyRed]: COLOR.keyRed,
  [TILE.keyGreen]: COLOR.keyGreen,
  [TILE.keyBlue]: COLOR.keyBlue,
};

function colorOf(tile: string): string {
  return KEY_COLOR[DOOR_KEY[tile] ?? tile] ?? COLOR.keyRed;
}

/**
 * Draws a level grid as the editor shows it: tiles as in the game, and
 * the player and monk start markers as the actors that will stand there. Tiles the game
 * hides are shown to the maker: trapdoor turf has a mark, a hidden ladder is dim, a monk
 * respawn point is a monk-coloured frame, and the exit is an outline.
 */
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  grid: readonly string[],
  links: readonly Teleport[] = [],
  picked: { readonly cx: number; readonly cy: number } | null = null,
): void {
  const size = gridCanvasSize(grid);
  ctx.fillStyle = COLOR.background;
  ctx.fillRect(0, 0, size.width, size.height);
  drawTiles(grid, (tile, _cx, _cy, x, y) => {
    if (tile === TILE.runnerStart) drawRunner(ctx, x, y, 1, false, 0);
    else if (tile === TILE.player2Start) drawRunner(ctx, x, y, 1, false, 1);
    else if (tile === TILE.monkStart) drawMonkAt(ctx, x, y, -1, false);
    else drawTile(ctx, tile, x, y, false, true);
  });
  // Faint cell lines, so empty cells can be aimed at.
  ctx.fillStyle = COLOR.gridLine;
  for (let x = TILE_PX; x < size.width; x += TILE_PX) ctx.fillRect(x, 0, 1, size.height);
  for (let y = TILE_PX; y < size.height; y += TILE_PX) ctx.fillRect(0, y, size.width, 1);
  for (const [fx, fy, tx, ty] of links) drawLink(ctx, fx, fy, tx, ty);
  if (picked !== null) drawPicked(ctx, picked.cx * TILE_PX, picked.cy * TILE_PX);
}

/** A teleporter link: a dotted line from the entrance's centre to a dot on the exit. */
function drawLink(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  tx: number,
  ty: number,
): void {
  const half = TILE_PX / 2;
  const x0 = fx * TILE_PX + half;
  const y0 = fy * TILE_PX + half;
  const x1 = tx * TILE_PX + half;
  const y1 = ty * TILE_PX + half;
  const dots = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 6));
  ctx.fillStyle = COLOR.link;
  for (let i = 0; i <= dots; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / dots);
    const y = Math.round(y0 + ((y1 - y0) * i) / dots);
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  ctx.fillRect(x1 - 3, y1 - 3, 6, 6);
}

/** The entrance picked by the link tool, waiting for its exit. */
function drawPicked(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const s = TILE_PX;
  ctx.fillStyle = COLOR.sparkle;
  ctx.fillRect(x, y, s, 1);
  ctx.fillRect(x, y + s - 1, s, 1);
  ctx.fillRect(x, y, 1, s);
  ctx.fillRect(x + s - 1, y, 1, s);
}

/** Canvas size for a grid; an empty grid gives 0 × 0. */
export function gridCanvasSize(grid: readonly string[]): { width: number; height: number } {
  return canvasSize({ width: grid[0]?.length ?? 0, height: grid.length });
}

/** Calls `draw` for every cell, with its tile, cell and pixel position. */
function drawTiles(
  rows: readonly string[],
  draw: (tile: string, cx: number, cy: number, x: number, y: number) => void,
): void {
  rows.forEach((row, cy) => {
    for (let cx = 0; cx < row.length; cx++)
      draw(row.charAt(cx), cx, cy, cx * TILE_PX, cy * TILE_PX);
  });
}

/**
 * How much of a hole's brick is visible, from 1 (whole brick) to 0 (fully open): it
 * shrinks while being dug and grows back while closing. A drilled hole starts with a
 * negative age (`tools.ts`): whole until its last `HOLE_TICKS.digging` ticks.
 */
export function brickLeft(age: number): number {
  switch (holePhase(age)) {
    case "digging":
      return Math.min(1, 1 - age / HOLE_TICKS.digging);
    case "open":
      return 0;
    case "closing":
      return (age - HOLE_TICKS.digging - HOLE_TICKS.open) / HOLE_TICKS.closing;
    case "filled":
      return 1;
  }
}

/**
 * A partly dug brick, or bedrock drilled by a jackhammer: the visible part sits at the
 * bottom of the cell.
 */
function drawHole(
  ctx: CanvasRenderingContext2D,
  tile: string,
  left: number,
  x: number,
  y: number,
): void {
  const h = Math.round(TILE_PX * left);
  if (h === 0) return;
  ctx.fillStyle = tile === TILE.bedrock ? COLOR.bedrock : COLOR.brick;
  ctx.fillRect(x, y + TILE_PX - h, TILE_PX, h);
}

/** A tile; `editor` shows the tiles the game hides (see `renderGrid`). */
function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: string,
  x: number,
  y: number,
  exitOpen: boolean,
  editor = false,
): void {
  const s = TILE_PX;
  switch (tile) {
    case TILE.brick:
      drawBrick(ctx, x, y);
      break;
    case TILE.trapdoor:
      // Looks like brick in the game: that is the trap.
      drawBrick(ctx, x, y);
      if (editor) {
        ctx.fillStyle = COLOR.trapdoorMark;
        for (let i = 2; i < s - 2; i += 5) ctx.fillRect(x + i, y + i, 3, 3);
      }
      break;
    case TILE.gooeyTurf:
      ctx.fillStyle = COLOR.goo;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COLOR.gooDrip;
      ctx.fillRect(x + 3, y + 6, 4, 8);
      ctx.fillRect(x + 11, y + 4, 3, 12);
      ctx.fillRect(x + 17, y + 8, 4, 7);
      break;
    case TILE.hiddenLadder:
      // Invisible in the game until the gold is gone (it then becomes a ladder).
      if (editor) drawLadder(ctx, x, y, COLOR.hiddenLadder);
      break;
    case TILE.alcove:
      // A dark arched niche.
      ctx.fillStyle = COLOR.alcove;
      ctx.fillRect(x + 2, y + 6, s - 4, s - 6);
      ctx.fillRect(x + 4, y + 3, s - 8, 3);
      ctx.fillRect(x + 7, y + 1, s - 14, 2);
      ctx.fillStyle = COLOR.alcoveInside;
      ctx.fillRect(x + 5, y + 8, s - 10, s - 8);
      ctx.fillRect(x + 8, y + 5, s - 16, 3);
      break;
    case TILE.teleportEntrance:
    case TILE.teleportExit: {
      // A pad: gold for an entrance, light blue for an exit.
      ctx.fillStyle = tile === TILE.teleportEntrance ? COLOR.teleportIn : COLOR.teleportOut;
      ctx.fillRect(x + 2, y + 2, s - 4, 2);
      ctx.fillRect(x + 2, y + 2, 2, s - 4);
      ctx.fillRect(x + s - 4, y + 2, 2, s - 4);
      ctx.fillRect(x + 1, y + s - 3, s - 2, 3);
      ctx.fillRect(x + 9, y + 8, 6, 2);
      ctx.fillRect(x + 11, y + 6, 2, 6);
      break;
    }
    case TILE.monkRespawn:
      // A marker only: nothing shows in the game.
      if (editor) {
        ctx.fillStyle = COLOR.monk;
        ctx.fillRect(x + 2, y + 2, s - 4, 2);
        ctx.fillRect(x + 2, y + s - 4, s - 4, 2);
        ctx.fillRect(x + 2, y + 2, 2, s - 4);
        ctx.fillRect(x + s - 4, y + 2, 2, s - 4);
        ctx.fillRect(x + 9, y + 9, 6, 6);
      }
      break;
    case TILE.bedrock:
      ctx.fillStyle = COLOR.bedrock;
      ctx.fillRect(x, y, s, s);
      break;
    case TILE.ladder:
      drawLadder(ctx, x, y, COLOR.ladder);
      break;
    case TILE.bar:
      ctx.fillStyle = COLOR.bar;
      ctx.fillRect(x, y + 3, s, 2);
      break;
    case TILE.gold:
      ctx.fillStyle = COLOR.gold;
      ctx.fillRect(x + 6, y + s - 10, s - 12, 8);
      break;
    case TILE.keyRed:
    case TILE.keyGreen:
    case TILE.keyBlue:
      // A key lying on its side: a ring, a shaft and two teeth.
      ctx.fillStyle = colorOf(tile);
      ctx.fillRect(x + 3, y + s - 12, 7, 2);
      ctx.fillRect(x + 3, y + s - 6, 7, 2);
      ctx.fillRect(x + 3, y + s - 12, 2, 8);
      ctx.fillRect(x + 8, y + s - 12, 2, 8);
      ctx.fillRect(x + 10, y + s - 9, 11, 2);
      ctx.fillRect(x + 15, y + s - 7, 2, 3);
      ctx.fillRect(x + 19, y + s - 7, 2, 3);
      break;
    case TILE.jackhammer:
      // Upright: a T handle, the body and the bit.
      ctx.fillStyle = COLOR.steelDark;
      ctx.fillRect(x + 5, y + 4, s - 10, 3);
      ctx.fillRect(x + 5, y + 4, 2, 5);
      ctx.fillRect(x + s - 7, y + 4, 2, 5);
      ctx.fillStyle = COLOR.steel;
      ctx.fillRect(x + 9, y + 7, 6, 10);
      ctx.fillRect(x + 11, y + 17, 2, 6);
      break;
    case TILE.pickaxe:
      // A curved steel head on a wooden handle.
      ctx.fillStyle = COLOR.handle;
      ctx.fillRect(x + 11, y + 8, 2, s - 9);
      ctx.fillStyle = COLOR.steel;
      ctx.fillRect(x + 5, y + 5, s - 10, 3);
      ctx.fillRect(x + 3, y + 7, 3, 3);
      ctx.fillRect(x + s - 6, y + 7, 3, 3);
      ctx.fillRect(x + 2, y + 10, 2, 2);
      ctx.fillRect(x + s - 4, y + 10, 2, 2);
      break;
    case TILE.smallBomb:
    case TILE.bigBomb:
      drawBomb(ctx, x, y, tile === TILE.bigBomb);
      break;
    case TILE.snare:
      // A coil of rope.
      ctx.fillStyle = COLOR.rope;
      ctx.fillRect(x + 5, y + s - 12, s - 10, 3);
      ctx.fillRect(x + 5, y + s - 4, s - 10, 3);
      ctx.fillRect(x + 4, y + s - 11, 3, 9);
      ctx.fillRect(x + s - 7, y + s - 11, 3, 9);
      ctx.fillStyle = COLOR.ropeDark;
      ctx.fillRect(x + 9, y + s - 8, s - 18, 2);
      break;
    case TILE.gasSpray:
      // A gun with a green tank on top.
      ctx.fillStyle = COLOR.gun;
      ctx.fillRect(x + 3, y + s - 11, s - 6, 5); // barrel
      ctx.fillRect(x + 6, y + s - 6, 4, 5); // grip
      ctx.fillStyle = COLOR.gunTank;
      ctx.fillRect(x + 9, y + s - 17, 8, 6); // tank
      break;
    case TILE.gooBucket:
      // A pail full of green goo, with a handle.
      ctx.fillStyle = COLOR.bucketRim;
      ctx.fillRect(x + 6, y + s - 17, s - 12, 2); // handle
      ctx.fillRect(x + 6, y + s - 17, 2, 5);
      ctx.fillRect(x + s - 8, y + s - 17, 2, 5);
      ctx.fillStyle = COLOR.bucket;
      ctx.fillRect(x + 5, y + s - 12, s - 10, 11); // pail
      ctx.fillStyle = COLOR.goo;
      ctx.fillRect(x + 6, y + s - 12, s - 12, 3); // goo
      ctx.fillStyle = COLOR.gooDrip;
      ctx.fillRect(x + 9, y + s - 9, 3, 4); // a drip down the side
      break;
    case TILE.doorRed:
    case TILE.doorGreen:
    case TILE.doorBlue:
      // A solid door of its key's colour, with a keyhole.
      ctx.fillStyle = colorOf(tile);
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COLOR.keyhole;
      ctx.fillRect(x + 10, y + 7, 4, 4);
      ctx.fillRect(x + 11, y + 11, 2, 6);
      break;
    case TILE.exit:
      // Not there in the game until all the gold is collected (S-015 @ 1:22–1:23); the
      // editor shows it as an outline.
      if (!exitOpen && !editor) break;
      ctx.strokeStyle = exitOpen ? COLOR.exitOpen : COLOR.exitLocked;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 4, y + 2, s - 8, s - 3);
      if (exitOpen) {
        ctx.fillStyle = COLOR.exitOpen;
        ctx.fillRect(x + 7, y + 5, s - 14, s - 9);
      }
      break;
    default:
      break;
  }
}

/** A small four-pointed star, centred in the tile at (x, y). */
function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const s = TILE_PX;
  ctx.fillStyle = COLOR.sparkle;
  ctx.fillRect(x + s / 2 - 1, y + 4, 2, s - 8);
  ctx.fillRect(x + 4, y + s / 2 - 1, s - 8, 2);
  ctx.fillRect(x + s / 2 - 3, y + s / 2 - 3, 6, 6);
}

function drawBrick(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const s = TILE_PX;
  ctx.fillStyle = COLOR.brick;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = COLOR.mortar;
  ctx.fillRect(x, y + s / 2 - 1, s, 2);
  ctx.fillRect(x + s / 2 - 1, y, 2, s / 2);
  ctx.fillRect(x, y + s / 2, 2, s / 2);
}

function drawLadder(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  const s = TILE_PX;
  ctx.fillStyle = color;
  ctx.fillRect(x + 4, y, 3, s);
  ctx.fillRect(x + s - 7, y, 3, s);
  for (let r = 3; r < s; r += 7) ctx.fillRect(x + 4, y + r, s - 8, 2);
}

/** A runner; player 2 (`index` 1) in its own colours; a hiding one in shadow. */
function drawRunner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: -1 | 1,
  dead: boolean,
  index: number,
  hidden = false,
): void {
  const s = TILE_PX;
  const second = index === 1;
  const body = second ? COLOR.runner2 : COLOR.runner;
  ctx.fillStyle = dead ? COLOR.runnerDead : hidden ? COLOR.runnerHidden : body;
  ctx.fillRect(x + 8, y + 2, 8, 7); // head
  ctx.fillRect(x + 6, y + 9, 12, 9); // body
  ctx.fillRect(x + 7, y + 18, 4, s - 18); // legs
  ctx.fillRect(x + 13, y + 18, 4, s - 18);
  const face = second ? COLOR.runner2Face : COLOR.runnerFace;
  ctx.fillStyle = hidden ? COLOR.runnerHiddenFace : face;
  ctx.fillRect(facing === 1 ? x + 13 : x + 9, y + 4, 2, 2); // eye shows facing
}

/**
 * A monk: a robed figure; a gold band on its head while it carries gold. A snared monk
 * hangs upside down from a rope; a dazed one has stars spinning over its head.
 */
function drawMonk(ctx: CanvasRenderingContext2D, m: Monk, tick: number): void {
  if (m.mode === "dead" || m.warp > 0) return;
  const x = m.x * PX_PER_SUB;
  const y = m.y * PX_PER_SUB;
  if (m.mode === "snared") {
    drawSnaredMonk(ctx, x, y);
    return;
  }
  drawMonkAt(ctx, x, y, m.facing, m.carry > 0);
  if (m.mode === "dazed") {
    ctx.fillStyle = COLOR.daze;
    const turn = (tick >> 3) % 2 === 0;
    ctx.fillRect(x + (turn ? 4 : 16), y - 2, 3, 3);
    ctx.fillRect(x + (turn ? 16 : 4), y, 3, 3);
  }
}

/** A monk hanging upside down by its feet, from a rope tied to the top of its cell. */
function drawSnaredMonk(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const s = TILE_PX;
  ctx.fillStyle = COLOR.rope;
  ctx.fillRect(x + 11, y, 2, 4);
  ctx.fillStyle = COLOR.monk;
  ctx.fillRect(x + 5, y + 4, 14, s - 13); // robe, upside down
  ctx.fillRect(x + 8, y + s - 9, 8, 7); // head, at the bottom
  ctx.fillStyle = COLOR.monkFace;
  ctx.fillRect(x + 11, y + s - 5, 2, 2);
}

function drawMonkAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: -1 | 1,
  carrying: boolean,
): void {
  const s = TILE_PX;
  ctx.fillStyle = COLOR.monk;
  ctx.fillRect(x + 8, y + 2, 8, 7); // head
  ctx.fillRect(x + 5, y + 9, 14, s - 9); // robe
  ctx.fillStyle = COLOR.monkFace;
  ctx.fillRect(facing === 1 ? x + 13 : x + 9, y + 4, 2, 2); // eye shows facing
  if (carrying) {
    ctx.fillStyle = COLOR.gold;
    ctx.fillRect(x + 8, y + 1, 8, 2);
  }
}
