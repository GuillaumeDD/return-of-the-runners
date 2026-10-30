import { TILE } from "../level/format";
import { craterAt, holeAt, isOpened, type Hole } from "./holes";
import { isFalling, overlapsCell } from "./move";
import { cellOf, isSolid, offsetOf, tileAt, type Terrain } from "./physics";
import { fireGas, type Cloud } from "./gas";
import { DRILL_TICKS, GAS_FIRE_TICKS, HOLE_TICKS, PICK_TICKS, RUBBLE_TICKS, SUB } from "./rules";
import { canLaySnare, type Snare } from "./snares";
import type { Actor, Player } from "./state";

/**
 * Tools, held in the item slot (`items.ts`) and used with the use key, once per press.
 * Using an empty slot or a key does nothing. Tools are never used up (S-019, S-021).
 *
 * - **Jackhammer** (S-019 @ 2:28–2:43): the player drills the cell below (brick or
 *   bedrock, not a ladder, a door or anything else), waits `DRILL_TICKS` while it
 *   opens, falls in, and goes on drilling down until the cell below cannot be drilled.
 *   Each drilled cell is a hole, so the shaft refills behind like any hole.
 * - **Pickaxe** (S-021 @ 0:06–0:15): the player swings at the cell in front of it,
 *   which must be empty; rubble appears there, falls to the first support and stays
 *   `RUBBLE_TICKS`, solid like bedrock. Rubble crushes any monk or player it touches
 *   while it falls, so a monk right in front is buried at once (S-021 @ 0:08;
 *   provisional for players).
 * - **Snare** and **gas gun**: see `snares.ts` and `gas.ts`. A snare is laid in the
 *   player's cell and used up; the gun is kept.
 */

/** Rubble from a pickaxe: in column `cx`, at `y` (sub-units, top edge). */
export interface Rubble {
  readonly cx: number;
  readonly y: number;
  /** Ticks since it landed; -1 while it falls. */
  readonly landed: number;
}

/** Whether landed rubble fills the cell (cx, cy): it is then solid, like bedrock. */
export function rubbleAt(rubble: readonly Rubble[], cx: number, cy: number): boolean {
  return rubble.some((r) => r.landed >= 0 && r.cx === cx && r.y === cy * SUB);
}

/** Whether any rubble, falling or landed, is even partly in the cell (cx, cy). */
export function rubbleIn(rubble: readonly Rubble[], cx: number, cy: number): boolean {
  return rubble.some((r) => r.cx === cx && Math.abs(r.y - cy * SUB) < SUB);
}

/** Whether a piece of rubble touches an actor (their boxes overlap). */
export function rubbleHits(r: Rubble, a: Pick<Actor, "x" | "y">): boolean {
  return Math.abs(a.x - r.cx * SUB) < SUB && Math.abs(a.y - r.y) < SUB;
}

export function isTool(tile: string): boolean {
  return tile === TILE.jackhammer || tile === TILE.pickaxe;
}

export interface ToolResult {
  readonly player: Player;
  readonly hole: Hole | null;
  readonly rubble: Rubble | null;
  /** A snare laid this tick. */
  readonly snare?: Snare;
  /** A gas cloud fired this tick. */
  readonly cloud?: Cloud;
}

/**
 * The cell the player works from: the nearest one, as when digging. Null if it is
 * falling, or would fall once snapped there.
 */
function footing(t: Terrain, p: Player, falling: boolean): { cx: number; cy: number } | null {
  if (falling) return null;
  const cx = cellOf(p.x + SUB / 2);
  const cy = cellOf(p.y + SUB / 2);
  if (isFalling(t, { ...p, x: cx * SUB, y: cy * SUB })) return null;
  return { cx, cy };
}

/**
 * A drill into the cell below (cx, cy): brick or bedrock, inside the level, not already
 * dug or blown open, no monk on it. The player snaps onto (cx, cy) and waits
 * `DRILL_TICKS`. The hole starts younger than a dug one (a negative age), so it stays in
 * its "digging" phase, still solid, for `DRILL_TICKS` instead of `HOLE_TICKS.digging`,
 * then lives on as a dug hole.
 */
function drill(t: Terrain, p: Player, cx: number, cy: number): ToolResult | null {
  const below = cy + 1;
  if (below >= t.height) return null;
  const raw = t.tiles[below]?.charAt(cx) ?? "";
  if (raw !== TILE.brick && raw !== TILE.bedrock) return null;
  if (holeAt(t.holes, cx, below) !== undefined || craterAt(t.craters, cx, below) !== undefined) {
    return null;
  }
  if (rubbleAt(t.rubble, cx, below)) return null;
  if (t.monks.some((m) => m.mode !== "dead" && overlapsCell(m, cx, below))) return null;
  return {
    player: { ...p, x: cx * SUB, y: cy * SUB, busy: DRILL_TICKS, drill: true },
    hole: { cx, cy: below, age: HOLE_TICKS.digging - DRILL_TICKS },
    rubble: null,
  };
}

/**
 * A press of the use key with the held item. `falling`: the player is falling (no tool
 * works then). Returns null when nothing happens.
 */
export function useTool(
  t: Terrain,
  p: Player,
  falling: boolean,
  snares: readonly Snare[],
): ToolResult | null {
  const at = footing(t, p, falling);
  if (at === null) return null;
  if (p.item === TILE.jackhammer) return drill(t, p, at.cx, at.cy);
  if (p.item === TILE.snare) {
    if (!canLaySnare(t.tiles, snares, at.cx, at.cy)) return null;
    return { player: { ...p, item: "" }, hole: null, rubble: null, snare: at };
  }
  if (p.item === TILE.gasSpray) {
    const cloud = fireGas(t, at.cx, at.cy, p.facing);
    if (cloud === null) return null;
    const player = { ...p, x: at.cx * SUB, y: at.cy * SUB, busy: GAS_FIRE_TICKS };
    return { player, hole: null, rubble: null, cloud };
  }
  if (p.item !== TILE.pickaxe) return null;
  const fx = at.cx + p.facing;
  const fy = at.cy;
  if (fx < 0 || fx >= t.width) return null;
  if (!canRest(t, fx, fy) || rubbleIn(t.rubble, fx, fy)) return null;
  return {
    player: { ...p, x: at.cx * SUB, y: at.cy * SUB, busy: PICK_TICKS },
    hole: null,
    rubble: { cx: fx, y: fy * SUB, landed: -1 },
  };
}

/**
 * A drilling player that has landed goes on: it drills the next cell below, or stops
 * when that cannot be drilled, or when it no longer holds the jackhammer.
 */
export function keepDrilling(t: Terrain, p: Player, falling: boolean): ToolResult {
  const none = { hole: null, rubble: null };
  if (p.drill && p.item !== TILE.jackhammer) return { player: { ...p, drill: false }, ...none };
  if (!p.drill || p.busy > 0 || falling) return { player: p, ...none };
  if (offsetOf(p.x) !== 0 || offsetOf(p.y) !== 0)
    return { player: { ...p, drill: false }, ...none };
  return drill(t, p, cellOf(p.x), cellOf(p.y)) ?? { player: { ...p, drill: false }, ...none };
}

/**
 * Whether rubble may sit in the cell (cx, cy): an empty cell, or an opened one (a hole
 * or a crater). Not in gold, an item, the exit, a teleporter or any other tile, which it
 * would seal.
 */
function canRest(t: Terrain, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= t.width || cy >= t.height) return false;
  return t.tiles[cy]?.charAt(cx) === TILE.empty || isOpened(t, cx, cy);
}

/** Whether rubble is held up at its place: aligned, over solid ground or landed rubble. */
function supported(t: Terrain, r: Rubble): boolean {
  if (offsetOf(r.y) !== 0) return false;
  const below = cellOf(r.y) + 1;
  if (below >= t.height) return true;
  // Landed rubble reads as bedrock (`tileAt`).
  const tile = tileAt(t, r.cx, below);
  return isSolid(tile) || tile === TILE.ladder;
}

/**
 * One tick of rubble, lowest first, so a piece resting on one that lands this tick
 * lands too. Falling rubble drops one sub-unit a tick (as fast as a falling runner,
 * faster than a monk) until it is held up, then lands; landed rubble that loses its
 * support (a hole opens under it) falls again. Rubble that comes to rest where it may
 * not (`canRest`) crumbles at once; landed rubble crumbles after `RUBBLE_TICKS`, or as
 * soon as its cell turns solid (a hole refilled, a crater filled). Returns the rubble in
 * creation order.
 */
export function stepRubble(t: Terrain): Rubble[] {
  const now: (Rubble | null)[] = [...t.rubble];
  const order = t.rubble.map((r, i) => ({ y: r.y, i })).sort((a, b) => b.y - a.y || a.i - b.i);
  for (const { i } of order) {
    const r = now[i];
    if (r === undefined || r === null) continue;
    const rest = { ...t, rubble: now.filter((o): o is Rubble => o !== null && o !== r) };
    let next: Rubble | null;
    if (r.landed >= 0) {
      const cy = cellOf(r.y);
      const raw = t.tiles[cy]?.charAt(r.cx) ?? "";
      const refilled = (raw === TILE.brick || raw === TILE.bedrock) && !isOpened(t, r.cx, cy);
      if (refilled || r.landed + 1 >= RUBBLE_TICKS) next = null;
      else if (!supported(rest, r)) next = { ...r, y: r.y + 1, landed: -1 };
      else next = { ...r, landed: r.landed + 1 };
    } else if (supported(rest, r)) {
      next = canRest(t, r.cx, cellOf(r.y)) ? { ...r, landed: 0 } : null;
    } else {
      next = { ...r, y: r.y + 1 };
    }
    now[i] = next;
  }
  return now.filter((r): r is Rubble => r !== null);
}
