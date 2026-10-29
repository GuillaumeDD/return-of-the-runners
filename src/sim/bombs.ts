import { DOOR_KEY, TILE } from "../level/format";
import { centerCell, setTile } from "./gold";
import { craterAt, type Crater, type Hole } from "./holes";
import { cellOf } from "./physics";
import { overlapsCell } from "./move";
import { BLAST_TICKS, CRATER_TICKS, FUSE_TICKS, SUB } from "./rules";
import type { Rubble } from "./tools";
import type { Actor, Player } from "./state";

/**
 * Bombs (S-015 @ 1:05–1:24, S-025 @ 1:04–1:15). Small bombs `o` and big bombs `O` lie in
 * cells of `tiles`, and read as empty for movement. A player in play whose centre enters
 * one picks it up into its bomb counter (`Player.bombs`, in pick-up order); monks walk
 * past them. The bomb key lays the first bomb picked up, lit, in the player's cell
 * (`GameState.fuses`); it explodes `FUSE_TICKS` later.
 *
 * - A **small** blast covers the bomb's row, two cells either side, and one cell either
 *   side in the rows above and below. Brick in it is blown away for `CRATER_TICKS`
 *   (`GameState.craters`), then comes back, and whoever is in it then dies, as in a
 *   refilled hole. Other tiles are unharmed.
 * - A **big** blast covers a round area about five cells across (`dx² + dy² ≤ 5`) and
 *   destroys the terrain in it for good, bedrock included; not the exit, gold, items or
 *   teleporters.
 *
 * Every monk and player in play whose centre is in a blast dies. A blast lights the
 * bombs lying in it: each explodes a fuse later (a chain reaction, S-015 @ 1:07.5–1:12).
 * Rubble in a blast is cleared. A bomb already burning in a blast keeps its fuse. Bombs
 * that explode on the same tick go off in the order they were lit.
 */

/** A lit bomb in cell (cx, cy), exploding in `left` ticks. */
export interface Fuse {
  readonly cx: number;
  readonly cy: number;
  readonly big: boolean;
  readonly left: number;
}

/** A blast, drawn for `BLAST_TICKS` after it went off (`age` counts from 0). */
export interface Blast {
  readonly cx: number;
  readonly cy: number;
  readonly big: boolean;
  readonly age: number;
}

export function isBomb(tile: string): boolean {
  return tile === TILE.smallBomb || tile === TILE.bigBomb;
}

/** Terrain a big blast destroys for good. */
const DESTROYED_BY_BIG: ReadonlySet<string> = new Set([
  TILE.brick,
  TILE.bedrock,
  TILE.gooeyTurf,
  TILE.trapdoor,
  TILE.ladder,
  TILE.hiddenLadder,
  TILE.bar,
  TILE.alcove,
  ...Object.keys(DOOR_KEY),
]);

/** The cells of a blast at (cx, cy) inside a `width` × `height` level, row by row. */
export function blastCells(
  cx: number,
  cy: number,
  big: boolean,
  width: number,
  height: number,
): { cx: number; cy: number }[] {
  const out: { cx: number; cy: number }[] = [];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const inside = big
        ? dx * dx + dy * dy <= 5
        : dy === 0 || (Math.abs(dy) === 1 && Math.abs(dx) <= 1);
      const x = cx + dx;
      const y = cy + dy;
      if (inside && x >= 0 && y >= 0 && x < width && y < height) out.push({ cx: x, cy: y });
    }
  }
  return out;
}

/** A player in play whose centre is on a bomb picks it up into its counter. */
export function collectBomb(
  tiles: readonly string[],
  p: Player,
): { tiles: readonly string[]; player: Player } {
  const { cx, cy } = centerCell(p);
  const here = tiles[cy]?.charAt(cx) ?? "";
  if (!isBomb(here)) return { tiles, player: p };
  return { tiles: setTile(tiles, cx, cy, TILE.empty), player: { ...p, bombs: p.bombs + here } };
}

/**
 * A press of the bomb key: the first bomb of the counter is laid, lit, in the player's
 * centre cell. Nothing happens with an empty counter, or when a bomb already burns or
 * lies in that cell.
 */
export function layBomb(
  tiles: readonly string[],
  fuses: readonly Fuse[],
  p: Player,
): { player: Player; fuse: Fuse } | null {
  const first = p.bombs.charAt(0);
  if (first === "") return null;
  const { cx, cy } = centerCell(p);
  if (isBomb(tiles[cy]?.charAt(cx) ?? "")) return null;
  if (fuses.some((f) => f.cx === cx && f.cy === cy)) return null;
  return {
    player: { ...p, bombs: p.bombs.slice(1) },
    fuse: { cx, cy, big: first === TILE.bigBomb, left: FUSE_TICKS },
  };
}

/** What `stepBombs` reads and changes. */
export interface BombWorld {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly string[];
  readonly holes: readonly Hole[];
  readonly craters: readonly Crater[];
  readonly rubble: readonly Rubble[];
  /** The bombs burning since an earlier tick. */
  readonly fuses: readonly Fuse[];
  /** The bombs laid this tick: they start burning next tick, so each burns FUSE_TICKS. */
  readonly laid: readonly Fuse[];
  readonly blasts: readonly Blast[];
}

export interface BombResult {
  readonly tiles: readonly string[];
  readonly holes: readonly Hole[];
  readonly craters: readonly Crater[];
  readonly rubble: readonly Rubble[];
  readonly fuses: readonly Fuse[];
  readonly blasts: readonly Blast[];
  /**
   * Whether an actor dies this tick: in a blast, or in a crater that filled. Never one in
   * transit through a teleporter.
   */
  readonly kills: (a: Actor) => boolean;
}

/**
 * One tick of bombs: blasts age, craters count down and fill, fuses burn and bombs
 * whose fuse ran out explode, in the order they were lit.
 */
export function stepBombs(w: BombWorld): BombResult {
  const blasts: Blast[] = w.blasts
    .map((b) => ({ ...b, age: b.age + 1 }))
    .filter((b) => b.age < BLAST_TICKS);
  const counted = w.craters.map((c) => ({ ...c, left: c.left - 1 }));
  const filled = counted.filter((c) => c.left <= 0);
  let craters: Crater[] = counted.filter((c) => c.left > 0);
  let tiles = w.tiles;
  let holes = w.holes;
  let rubble = w.rubble;
  const burning = w.fuses.map((f) => ({ ...f, left: f.left - 1 }));
  const lit: Fuse[] = [];
  const key = (cx: number, cy: number): string => `${String(cx)},${String(cy)}`;
  const blasted = new Set<string>();
  for (const f of burning) {
    if (f.left > 0) continue;
    blasts.push({ cx: f.cx, cy: f.cy, big: f.big, age: 0 });
    for (const { cx, cy } of blastCells(f.cx, f.cy, f.big, w.width, w.height)) {
      blasted.add(key(cx, cy));
      const tile = tiles[cy]?.charAt(cx) ?? "";
      if (isBomb(tile)) {
        tiles = setTile(tiles, cx, cy, TILE.empty);
        lit.push({ cx, cy, big: tile === TILE.bigBomb, left: FUSE_TICKS });
      } else if (f.big && DESTROYED_BY_BIG.has(tile)) {
        tiles = setTile(tiles, cx, cy, TILE.empty);
        craters = craters.filter((c) => c.cx !== cx || c.cy !== cy);
      } else if (!f.big && tile === TILE.brick && craterAt(craters, cx, cy) === undefined) {
        craters = [...craters, { cx, cy, left: CRATER_TICKS }];
      } else continue;
      holes = holes.filter((h) => h.cx !== cx || h.cy !== cy);
    }
  }
  // Rubble covers one cell, or two while it falls between them.
  rubble = rubble.filter(
    (r) => !blasted.has(key(r.cx, cellOf(r.y))) && !blasted.has(key(r.cx, cellOf(r.y + SUB - 1))),
  );
  // A crater blown again by a big bomb is already gone; one that fills this tick comes
  // back unless a blast opened it again.
  const back = filled.filter(
    (c) => craterAt(craters, c.cx, c.cy) === undefined && tiles[c.cy]?.charAt(c.cx) === TILE.brick,
  );
  const kills = (a: Actor): boolean => {
    if (a.warp > 0) return false;
    const { cx, cy } = centerCell(a);
    return blasted.has(key(cx, cy)) || back.some((c) => overlapsCell(a, c.cx, c.cy));
  };
  return {
    tiles,
    holes,
    craters,
    rubble,
    fuses: [...burning.filter((f) => f.left > 0), ...w.laid, ...lit],
    blasts,
    kills,
  };
}
