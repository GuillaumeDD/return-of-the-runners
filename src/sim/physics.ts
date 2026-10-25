import { TILE } from "../level/format";
import { isDugOut } from "./holes";
import { SUB } from "./rules";
import type { GameState } from "./state";

/**
 * What movement needs to know: the terrain, the holes, and the monks, whose bodies hold
 * up whoever stands on them. When moving a monk, `monks` holds the other monks only.
 */
export type Terrain = Pick<GameState, "width" | "height" | "tiles" | "holes" | "monks">;

/**
 * Tile at a cell, as actors experience it: a dug-out brick reads as empty, and anything
 * outside the level reads as bedrock (a solid wall).
 */
export function tileAt(t: Terrain, cx: number, cy: number): string {
  if (cx < 0 || cy < 0 || cx >= t.width || cy >= t.height) return TILE.bedrock;
  if (isDugOut(t.holes, cx, cy)) return TILE.empty;
  return t.tiles[cy]?.charAt(cx) ?? TILE.bedrock;
}

export function isSolid(tile: string): boolean {
  return tile === TILE.brick || tile === TILE.bedrock;
}

/** An actor may occupy any non-solid cell. */
export function isPassable(t: Terrain, cx: number, cy: number): boolean {
  return !isSolid(tileAt(t, cx, cy));
}

export function isLadder(t: Terrain, cx: number, cy: number): boolean {
  return tileAt(t, cx, cy) === TILE.ladder;
}

export function isBar(t: Terrain, cx: number, cy: number): boolean {
  return tileAt(t, cx, cy) === TILE.bar;
}

/**
 * Whether an actor standing exactly on cell (cx, cy) is held up: by a ladder or bar in
 * its own cell, or by a solid tile, a ladder, a monk, or the level floor below it.
 */
export function isSupported(t: Terrain, cx: number, cy: number): boolean {
  if (isLadder(t, cx, cy) || isBar(t, cx, cy)) return true;
  if (cy + 1 >= t.height) return true;
  const below = tileAt(t, cx, cy + 1);
  return isSolid(below) || below === TILE.ladder || monkAt(t, cx, cy + 1);
}

/** Whether a monk's body (its centre cell) is in cell (cx, cy). Dead monks are not. */
export function monkAt(t: Pick<Terrain, "monks">, cx: number, cy: number): boolean {
  return t.monks.some(
    (m) => m.mode !== "dead" && cellOf(m.x + SUB / 2) === cx && cellOf(m.y + SUB / 2) === cy,
  );
}

/** Floor division that also works for negative offsets. */
export function cellOf(sub: number): number {
  return Math.floor(sub / SUB);
}

export function offsetOf(sub: number): number {
  return ((sub % SUB) + SUB) % SUB;
}
