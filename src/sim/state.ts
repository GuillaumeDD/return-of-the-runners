import { TILE, type Level, type Teleport } from "../level/format";
import { countGold, revealLadders } from "./gold";
import type { Crater, Hole } from "./holes";
import type { Blast, Fuse } from "./bombs";
import type { Rubble } from "./tools";
import { START_LIVES, SUB } from "./rules";

export type Facing = -1 | 1;

export interface Actor {
  /** Position of the actor's top-left corner, in sub-units. */
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
  /** Ticks left in an action that blocks movement (digging); 0 when free. */
  readonly busy: number;
  /**
   * Ticks left in transit through a teleporter (see `teleport.ts`); 0 otherwise. In
   * transit, the actor is already at the exit, but not drawn and not in play.
   */
  readonly warp: number;
}

/**
 * What a monk is doing. `free`: chasing. `trapped`: stuck in a hole for `timer` ticks.
 * `escaping`: climbing out of the hole at (`holeX`, `holeY`). `dead`: waiting `timer`
 * ticks to reappear.
 */
export type MonkMode = "free" | "trapped" | "escaping" | "dead";

export interface Monk extends Actor {
  readonly mode: MonkMode;
  readonly timer: number;
  /**
   * Gold carrying, as in the 1982 game: 0 carries nothing; n > 0 carries gold and tries
   * to drop it after n more cells; n < 0 just dropped gold and waits -n cells before
   * picking any up again.
   */
  readonly carry: number;
  /** The hole a trapped or escaping monk is in; -1 otherwise. */
  readonly holeX: number;
  readonly holeY: number;
}

/**
 * What a player is doing. `alive`: in play. `dead`: caught or buried, waiting `timer`
 * ticks to reappear at its start (two-player games only). `out`: no life left.
 */
export type PlayerMode = "alive" | "dead" | "out";

export interface Player extends Actor {
  readonly mode: PlayerMode;
  readonly timer: number;
  /** Lives left, this one included: a death takes one, and at 0 the player is out. */
  readonly lives: number;
  /** Gold this player has collected (its own count, as in TLR's status bar). */
  readonly gold: number;
  /** Where the player starts and reappears, in sub-units. */
  readonly startX: number;
  readonly startY: number;
  /** The item in the player's slot (an item tile, `items.ts`); `""` when empty. */
  readonly item: string;
  /** The pick-up key was held last tick: a held key acts only on the tick it is pressed. */
  readonly pickHeld: boolean;
  /** The use key was held last tick (as `pickHeld`). */
  readonly useHeld: boolean;
  /** Drilling down with a jackhammer (`tools.ts`): goes on after each fall. */
  readonly drill: boolean;
  /**
   * The bombs this player carries (`bombs.ts`), one bomb tile each, in the order they
   * were picked up; `""` for none. Its length is the bomb counter.
   */
  readonly bombs: string;
  /** The bomb key was held last tick (as `pickHeld`). */
  readonly bombHeld: boolean;
}

/**
 * `dead`: the level is lost (in a one-player game, the player died; with two, both are
 * out). `won`: a player reached the open exit.
 */
export type Status = "playing" | "dead" | "won";

/** One or two players: `P` is player 1, `Q` player 2. */
export type PlayerCount = 1 | 2;

/**
 * The whole game state: plain data only (no classes, no functions), so it can be
 * hashed, cloned and compared. `step` returns a new state; it never mutates.
 */
export interface GameState {
  readonly tick: number;
  readonly rng: number;
  readonly width: number;
  readonly height: number;
  /**
   * Terrain, `height` rows of `width` tile chars. Start markers become empty; collected
   * gold is removed.
   */
  readonly tiles: readonly string[];
  /** The level's teleporter links (static), entrance to exit, as in the level. */
  readonly teleports: readonly Teleport[];
  /** Gold not yet collected by a player. The exit opens when it reaches 0. */
  readonly goldLeft: number;
  /** Holes being dug or open, ordered by creation (deterministic). */
  readonly holes: readonly Hole[];
  /** Pickaxe rubble, falling or landed, ordered by creation (`tools.ts`). */
  readonly rubble: readonly Rubble[];
  /** Bricks blown away by small bombs, ordered by creation (`bombs.ts`). */
  readonly craters: readonly Crater[];
  /** Lit bombs, ordered by when they were lit (`bombs.ts`). */
  readonly fuses: readonly Fuse[];
  /** Blasts still drawn, ordered by when they went off (`bombs.ts`). */
  readonly blasts: readonly Blast[];
  /** Player 1, then player 2 in a two-player game; this order is the update order. */
  readonly players: readonly Player[];
  /** Monks in level reading order (row by row); this order is the update order. */
  readonly monks: readonly Monk[];
  readonly status: Status;
}

export function newMonk(cx: number, cy: number): Monk {
  return {
    x: cx * SUB,
    y: cy * SUB,
    facing: -1,
    busy: 0,
    warp: 0,
    mode: "free",
    timer: 0,
    carry: 0,
    holeX: -1,
    holeY: -1,
  };
}

function findTile(level: Level, tile: string): { cx: number; cy: number } | null {
  for (let cy = 0; cy < level.grid.length; cy++) {
    const cx = (level.grid[cy] ?? "").indexOf(tile);
    if (cx >= 0) return { cx, cy };
  }
  return null;
}

/** How many players can play a level: two when it has a player 2 start. */
export function maxPlayers(level: Level): PlayerCount {
  return findTile(level, TILE.player2Start) === null ? 1 : 2;
}

export function newPlayer(cx: number, cy: number): Player {
  const x = cx * SUB;
  const y = cy * SUB;
  return {
    x,
    y,
    facing: 1,
    busy: 0,
    warp: 0,
    mode: "alive",
    timer: 0,
    lives: START_LIVES,
    gold: 0,
    startX: x,
    startY: y,
    item: "",
    pickHeld: false,
    useHeld: false,
    drill: false,
    bombs: "",
    bombHeld: false,
  };
}

/**
 * The state at the start of a level. With `players` = 1, a player 2 start is ignored
 * (an empty cell); 2 needs one.
 */
export function createState(level: Level, seed: number, players: PlayerCount = 1): GameState {
  const p1 = findTile(level, TILE.runnerStart);
  if (p1 === null) {
    throw new Error("createState: level has no runner start (validate it first)");
  }
  const p2 = players === 2 ? findTile(level, TILE.player2Start) : null;
  if (players === 2 && p2 === null) {
    throw new Error("createState: two players need a player 2 start");
  }
  const monks: Monk[] = [];
  level.grid.forEach((row, cy) => {
    for (let cx = 0; cx < row.length; cx++) {
      if (row.charAt(cx) === TILE.monkStart) monks.push(newMonk(cx, cy));
    }
  });
  // Start markers are not terrain: the cells they mark are empty.
  const tiles = level.grid.map((row) =>
    row
      .replaceAll(TILE.runnerStart, TILE.empty)
      .replaceAll(TILE.player2Start, TILE.empty)
      .replaceAll(TILE.monkStart, TILE.empty),
  );
  const goldLeft = countGold(tiles);
  return {
    tick: 0,
    rng: seed >>> 0,
    width: level.width,
    height: level.height,
    // A level without gold shows its hidden ladders from the start.
    tiles: revealLadders(tiles, goldLeft),
    teleports: level.teleports,
    goldLeft,
    holes: [],
    rubble: [],
    craters: [],
    fuses: [],
    blasts: [],
    players:
      p2 === null ? [newPlayer(p1.cx, p1.cy)] : [newPlayer(p1.cx, p1.cy), newPlayer(p2.cx, p2.cy)],
    monks,
    status: "playing",
  };
}
