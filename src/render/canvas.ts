import { TILE } from "../level/format";
import { holeAt, holePhase } from "../sim/holes";
import { HOLE_TICKS, SUB } from "../sim/rules";
import type { GameState } from "../sim/state";

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
  runnerDead: "#d64545",
} as const;

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
  state.tiles.forEach((row, cy) => {
    for (let cx = 0; cx < row.length; cx++) {
      const tile = row.charAt(cx);
      const hole = holeAt(state.holes, cx, cy);
      if (hole === undefined) drawTile(ctx, tile, cx * TILE_PX, cy * TILE_PX, exitOpen);
      else drawHole(ctx, brickLeft(hole.age), cx * TILE_PX, cy * TILE_PX);
    }
  });
  drawRunner(
    ctx,
    state.runner.x * PX_PER_SUB,
    state.runner.y * PX_PER_SUB,
    state.runner.facing,
    state.status === "dead",
  );
}

/**
 * How much of a hole's brick is visible, from 1 (whole brick) to 0 (fully open): it
 * shrinks while being dug and grows back while closing.
 */
export function brickLeft(age: number): number {
  switch (holePhase(age)) {
    case "digging":
      return 1 - age / HOLE_TICKS.digging;
    case "open":
      return 0;
    case "closing":
      return (age - HOLE_TICKS.digging - HOLE_TICKS.open) / HOLE_TICKS.closing;
    case "filled":
      return 1;
  }
}

/** A partly dug brick: the visible part sits at the bottom of the cell. */
function drawHole(ctx: CanvasRenderingContext2D, left: number, x: number, y: number): void {
  const h = Math.round(TILE_PX * left);
  if (h === 0) return;
  ctx.fillStyle = COLOR.brick;
  ctx.fillRect(x, y + TILE_PX - h, TILE_PX, h);
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: string,
  x: number,
  y: number,
  exitOpen: boolean,
): void {
  const s = TILE_PX;
  switch (tile) {
    case TILE.brick:
      ctx.fillStyle = COLOR.brick;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COLOR.mortar;
      ctx.fillRect(x, y + s / 2 - 1, s, 2);
      ctx.fillRect(x + s / 2 - 1, y, 2, s / 2);
      ctx.fillRect(x, y + s / 2, 2, s / 2);
      break;
    case TILE.bedrock:
      ctx.fillStyle = COLOR.bedrock;
      ctx.fillRect(x, y, s, s);
      break;
    case TILE.ladder:
      ctx.fillStyle = COLOR.ladder;
      ctx.fillRect(x + 4, y, 3, s);
      ctx.fillRect(x + s - 7, y, 3, s);
      for (let r = 3; r < s; r += 7) ctx.fillRect(x + 4, y + r, s - 8, 2);
      break;
    case TILE.bar:
      ctx.fillStyle = COLOR.bar;
      ctx.fillRect(x, y + 3, s, 2);
      break;
    case TILE.gold:
      ctx.fillStyle = COLOR.gold;
      ctx.fillRect(x + 6, y + s - 10, s - 12, 8);
      break;
    case TILE.exit:
      // A door: an outline while locked, filled once all the gold is collected.
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

function drawRunner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: -1 | 1,
  dead: boolean,
): void {
  const s = TILE_PX;
  ctx.fillStyle = dead ? COLOR.runnerDead : COLOR.runner;
  ctx.fillRect(x + 8, y + 2, 8, 7); // head
  ctx.fillRect(x + 6, y + 9, 12, 9); // body
  ctx.fillRect(x + 7, y + 18, 4, s - 18); // legs
  ctx.fillRect(x + 13, y + 18, 4, s - 18);
  ctx.fillStyle = COLOR.runnerFace;
  ctx.fillRect(facing === 1 ? x + 13 : x + 9, y + 4, 2, 2); // eye shows facing
}
