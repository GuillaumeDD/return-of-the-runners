import { TILE } from "../level/format";
import { monkAt, type Terrain } from "./physics";

/**
 * Monk chase AI: the classic Lode Runner algorithm (from the 1982 game, as described in
 * its published source and kept by faithful remakes), reimplemented here. TLR's own AI is
 * not documented; this is the provisional fallback (see ARCHITECTURE).
 *
 * It works on whole cells and on the level's static tiles: holes count as the brick they
 * were dug in, so monks walk into them, as in the original.
 *
 * The runner is the player the monk chases (the nearest one, see `targetOf`).
 *
 * 1. If the runner is on the monk's row and the floor between them is walkable, go
 *    straight at the runner.
 * 2. Otherwise scan the monk's floor, left and right up to a wall or an edge. From each
 *    reachable column, look how far down (by falling or a ladder) and up (by a ladder)
 *    the monk could go, and rate where it would end up: on the runner's row is best
 *    (closest column first), above the runner is next, below is worst. Go toward the best.
 */

export type MonkMove = "left" | "right" | "up" | "down" | "none";

export interface ChaseView {
  /** The monk's cell (its centre cell) and its x position, in sub-units. */
  readonly cx: number;
  readonly cy: number;
  readonly x: number;
  /** The chased player's cell and x position, and whether it is falling. */
  readonly rx: number;
  readonly ry: number;
  readonly runnerX: number;
  readonly runnerFalling: boolean;
}

/** Static tile: holes ignored, the exit reads as empty, outside the level as bedrock. */
function base(t: Terrain, x: number, y: number): string {
  if (x < 0 || y < 0 || x >= t.width || y >= t.height) return TILE.bedrock;
  const c = t.tiles[y]?.charAt(x) ?? TILE.bedrock;
  return c === TILE.exit ? TILE.empty : c;
}

function isFloor(c: string): boolean {
  return c === TILE.brick || c === TILE.bedrock;
}

/** Floor a monk can stand or walk on: brick, bedrock or a ladder top. */
function isStandable(c: string): boolean {
  return isFloor(c) || c === TILE.ladder;
}

/**
 * The next move toward the runner. `t.monks` must hold the other monks only (their
 * bodies are floor, as in the original).
 */
export function chooseMove(t: Terrain, v: ChaseView): MonkMove {
  const maxY = t.height - 1;

  if (v.cy === v.ry && !v.runnerFalling) {
    let x = v.cx;
    while (x !== v.rx) {
      const here = base(t, x, v.cy);
      const below = v.cy < maxY ? base(t, x, v.cy + 1) : TILE.bedrock;
      const walkable =
        here === TILE.ladder ||
        here === TILE.bar ||
        isStandable(below) ||
        below === TILE.bar ||
        below === TILE.gold ||
        monkAt(t, x, v.cy + 1);
      if (!walkable) break;
      x += x < v.rx ? 1 : -1;
    }
    if (x === v.rx) {
      if (v.cx < v.rx) return "right";
      if (v.cx > v.rx) return "left";
      return v.x < v.runnerX ? "right" : "left";
    }
  }
  return scanFloor(t, v);
}

interface Best {
  rating: number;
  move: MonkMove;
}

function scanFloor(t: Terrain, v: ChaseView): MonkMove {
  const maxX = t.width - 1;
  const maxY = t.height - 1;
  const y = v.cy;
  const best: Best = { rating: 255, move: "none" };

  // Ends of the floor: stop before a wall; include the first cell the monk would fall from.
  const end = (dir: -1 | 1): number => {
    let x = v.cx;
    while (dir === -1 ? x > 0 : x < maxX) {
      const next = base(t, x + dir, y);
      if (isFloor(next)) break;
      x += dir;
      const held = next === TILE.ladder || next === TILE.bar || y >= maxY;
      if (!held && !isStandable(base(t, x, y + 1))) break;
    }
    return x;
  };
  const leftEnd = end(-1);
  const rightEnd = end(1);

  const scanColumn = (x: number, move: MonkMove): void => {
    if (y < maxY && !isFloor(base(t, x, y + 1))) scanDown(t, v, x, move, best);
    if (base(t, x, y) === TILE.ladder) scanUp(t, v, x, move, best);
  };

  // From the monk's own column, going down or up; then the columns to each side.
  if (y < maxY && !isFloor(base(t, v.cx, y + 1))) scanDown(t, v, v.cx, "down", best);
  if (base(t, v.cx, y) === TILE.ladder) scanUp(t, v, v.cx, "up", best);

  for (let x = leftEnd; x < v.cx; x++) scanColumn(x, "left");
  for (let x = rightEnd; x > v.cx; x--) scanColumn(x, "right");
  return best.move;
}

/** Whether the monk could step sideways off column x at row y (floor or a bar there). */
function canLeave(t: Terrain, x: number, y: number, dir: -1 | 1): boolean {
  const side = x + dir;
  if (side < 0 || side > t.width - 1) return false;
  return isStandable(base(t, side, y + 1)) || base(t, side, y) === TILE.bar;
}

function rate(v: ChaseView, x: number, y: number, move: MonkMove, best: Best): void {
  let rating: number;
  if (y === v.ry) rating = Math.abs(v.cx - x);
  else if (y > v.ry) rating = y - v.ry + 200;
  else rating = v.ry - y + 100;
  if (rating < best.rating) {
    best.rating = rating;
    best.move = move;
  }
}

function scanDown(t: Terrain, v: ChaseView, x: number, move: MonkMove, best: Best): void {
  const maxY = t.height - 1;
  let y = v.cy;
  while (y < maxY && !isFloor(base(t, x, y + 1))) {
    // Only when held up here (not in free fall) can the monk leave sideways.
    if (base(t, x, y) !== TILE.empty) {
      if ((canLeave(t, x, y, -1) || canLeave(t, x, y, 1)) && y >= v.ry) break;
    }
    y++;
  }
  rate(v, x, y, move, best);
}

function scanUp(t: Terrain, v: ChaseView, x: number, move: MonkMove, best: Best): void {
  let y = v.cy;
  while (y > 0 && base(t, x, y) === TILE.ladder) {
    y--;
    if ((canLeave(t, x, y, -1) || canLeave(t, x, y, 1)) && y <= v.ry) break;
  }
  rate(v, x, y, move, best);
}
