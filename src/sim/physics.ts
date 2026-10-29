import { DOOR_KEY, TILE } from "../level/format";
import { isDugOut } from "./holes";
import { SUB } from "./rules";
import type { GameState } from "./state";

/**
 * What movement needs to know: the terrain, the holes, and the monks, whose bodies hold
 * up whoever stands on them. When moving a monk, `monks` holds the other monks only.
 */
export type Terrain = Pick<GameState, "width" | "height" | "tiles" | "holes" | "monks">;

/**
 * Tiles actors move through as if the cell were empty: trapdoor turf (drawn like brick,
 * but nothing is there), a hidden ladder not yet revealed (it becomes a ladder in
 * `tiles` once the gold is gone, see `revealLadders`), an alcove (a hiding place with
 * no support of its own), a monk respawn point (a marker), both teleporter ends
 * (the jump itself is in `teleport.ts`) and the items lying in a cell (`items.ts`).
 */
const AS_EMPTY: ReadonlySet<string> = new Set([
  TILE.keyRed,
  TILE.keyGreen,
  TILE.keyBlue,
  TILE.teleportEntrance,
  TILE.teleportExit,
  TILE.trapdoor,
  TILE.hiddenLadder,
  TILE.alcove,
  TILE.monkRespawn,
]);

/** A level tile as actors experience it (see `AS_EMPTY`); other tiles are themselves. */
export function actorTile(tile: string): string {
  return AS_EMPTY.has(tile) ? TILE.empty : tile;
}

/**
 * Tile at a cell, as actors experience it: a dug-out brick reads as empty, so do the
 * `AS_EMPTY` tiles, and anything outside the level reads as bedrock (a solid wall).
 */
export function tileAt(t: Terrain, cx: number, cy: number): string {
  if (cx < 0 || cy < 0 || cx >= t.width || cy >= t.height) return TILE.bedrock;
  if (isDugOut(t.holes, cx, cy)) return TILE.empty;
  return actorTile(t.tiles[cy]?.charAt(cx) ?? TILE.bedrock);
}

/** Walls and floors: brick, bedrock, gooey turf and closed doors (only brick can be dug). */
export function isSolid(tile: string): boolean {
  return (
    tile === TILE.brick ||
    tile === TILE.bedrock ||
    tile === TILE.gooeyTurf ||
    Object.hasOwn(DOOR_KEY, tile)
  );
}

/**
 * Whether an actor at `a` walks on gooey turf: the cell below its centre column is goo.
 * It then walks at `GOO_PERIOD`.
 */
export function onGoo(t: Terrain, a: { readonly x: number; readonly y: number }): boolean {
  return tileAt(t, cellOf(a.x + SUB / 2), cellOf(a.y) + 1) === TILE.gooeyTurf;
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

/**
 * Whether a monk's body (its centre cell) is in cell (cx, cy). Dead monks and monks in
 * transit through a teleporter are not.
 */
export function monkAt(t: Pick<Terrain, "monks">, cx: number, cy: number): boolean {
  return t.monks.some(
    (m) =>
      m.mode !== "dead" &&
      m.warp === 0 &&
      cellOf(m.x + SUB / 2) === cx &&
      cellOf(m.y + SUB / 2) === cy,
  );
}

/** Floor division that also works for negative offsets. */
export function cellOf(sub: number): number {
  return Math.floor(sub / SUB);
}

export function offsetOf(sub: number): number {
  return ((sub % SUB) + SUB) % SUB;
}
