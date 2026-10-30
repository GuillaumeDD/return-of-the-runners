import { TILE } from "../level/format";
import { collectBomb, layBomb, stepBombs, type Fuse } from "./bombs";
import { stepClouds, type Cloud } from "./gas";
import { centerCell, revealLadders, takeGold } from "./gold";
import { HOLE_LIFETIME, holeAt, type Hole } from "./holes";
import { NO_INPUT, type PlayerInput, type TickInput } from "./input";
import { openDoor, pickUp } from "./items";
import { inSight, stepMonks } from "./monks";
import { inTransit, tryTeleport } from "./teleport";
import type { Snare } from "./snares";
import { keepDrilling, rubbleHits, stepRubble, useTool, type Rubble } from "./tools";
import { isFalling, overlapsCell, stepActor } from "./move";
import { cellOf, monkAt, tileAt, type Terrain } from "./physics";
import { HOLE_TICKS, MONK_TICKS, PLAYER_RESPAWN_TICKS, RUNNER_PERIOD, SUB } from "./rules";
import type { Actor, Facing, GameState, Monk, Player } from "./state";

/**
 * Advances the game by one tick. Pure: returns a new state. `inputs[i]` drives player i
 * (missing: no input).
 *
 * Order within a tick: each player in order acts (dig or move) on the current terrain;
 * a dead player counts down, then reappears at its start; a player that ends its move
 * on a teleporter entrance jumps (see `teleport.ts`). A player in an alcove hides with
 * up and comes out with down (`tryHide`). A player in play and not hiding then picks up,
 * swaps or drops an item if it just pressed the pick-up key, opens a door next to it
 * that its key fits (`items.ts`), uses its tool if it just pressed the use key (laying a
 * snare, firing gas or throwing goo among them), or goes on drilling down (`tools.ts`), picks up the gold and the bombs it touches, and lays a
 * bomb if it just pressed the bomb key (`bombs.ts`).
 * Once the last gold is taken, hidden ladders appear. A player touching the open exit
 * wins the level (`playersAtExit`). Unless it was won, the monks then act in order: a
 * monk walking into a snare hangs in it, one in a gas cloud is dazed, and a monk
 * touching a player catches it (`monks.ts`). Gas clouds then thin out. Then holes age: a player or monk inside a hole
 * that just filled dies (no player dies on the winning tick). Bombs then burn and
 * explode, killing whoever is in a blast or in a crater that filled. Rubble then falls
 * or crumbles, and falling rubble crushes the monks and players it touches. Last,
 * deaths are counted (see `die`).
 */
export function step(state: GameState, inputs: TickInput): GameState {
  const tick = state.tick + 1;
  if (state.status !== "playing") return { ...state, tick };

  let tiles = state.tiles;
  let goldLeft = state.goldLeft;
  let holes = state.holes;
  let rubble: readonly Rubble[] = state.rubble;
  let laid: readonly Fuse[] = [];
  let snares: readonly Snare[] = state.snares;
  let clouds: readonly Cloud[] = state.clouds;
  const players: Player[] = [];
  // Someone monks can see (players in transit are seen at their exit; hiding players
  // are not): a dead player waits for a monk to leave its start only then.
  const anyAlive = state.players.some((p) => inSight(p));
  for (let i = 0; i < state.players.length; i++) {
    const before = state.players[i];
    if (before === undefined) continue;
    const t: Terrain = { ...state, tiles, holes, rubble };
    const input = inputs[i] ?? NO_INPUT;
    const acted = actPlayer(t, before, input, tick, anyAlive);
    let p: Player = {
      ...acted.player,
      pickHeld: input.pickUp,
      useHeld: input.use,
      bombHeld: input.bomb,
    };
    if (acted.hole !== null) holes = [...holes, acted.hole];
    if (p.mode === "alive") p = tryTeleport(state, p, state.monks);
    if (inTransit(p)) p = { ...p, drill: false };
    if (p.mode === "alive" && !inTransit(p) && !p.hidden) {
      // The pick-up and use keys act on the tick they are pressed, unless the player is
      // busy (digging, drilling or swinging).
      if (input.pickUp && !before.pickHeld && p.busy === 0) {
        ({ tiles, player: p } = pickUp(tiles, p));
      }
      ({ tiles, player: p } = openDoor(tiles, p));
      const here: Terrain = { ...state, tiles, holes, rubble };
      const falling = isFalling(here, p);
      const used =
        input.use && !before.useHeld && p.busy === 0
          ? useTool(here, p, falling, snares)
          : keepDrilling(here, p, falling);
      if (used !== null) {
        p = used.player;
        if (used.hole !== null) holes = [...holes, used.hole];
        if (used.rubble !== null) rubble = [...rubble, used.rubble];
        if (used.snare !== undefined) snares = [...snares, used.snare];
        if (used.cloud !== undefined) clouds = [...clouds, used.cloud];
        if (used.tiles !== undefined) tiles = used.tiles;
      }
      const { cx, cy } = centerCell(p);
      const taken = takeGold(tiles, cx, cy);
      if (taken !== null) {
        tiles = taken;
        goldLeft -= 1;
        p = { ...p, gold: p.gold + 1 };
      }
      ({ tiles, player: p } = collectBomb(tiles, p));
      if (input.bomb && !before.bombHeld && p.busy === 0 && !falling) {
        const lay = layBomb(tiles, [...state.fuses, ...laid], p);
        if (lay !== null) {
          p = lay.player;
          laid = [...laid, lay.fuse];
        }
      }
    }
    players.push(p);
  }
  tiles = revealLadders(tiles, goldLeft);
  const won = playersAtExit({ tiles, goldLeft, players }).length > 0;

  let monks = state.monks;
  let rng = state.rng;
  let caught: readonly boolean[] = players.map(() => false);
  if (!won) {
    const after = stepMonks(
      { ...state, tiles, goldLeft, players, holes, rubble, snares, clouds },
      tick,
    );
    ({ monks, tiles, rng, caught, snares } = after);
  }
  clouds = stepClouds(clouds);

  const aged = holes.map((h) => ({ ...h, age: h.age + 1 }));
  const filled = aged.filter((h) => h.age >= HOLE_LIFETIME);
  const buried = (a: Actor): boolean => filled.some((h) => overlapsCell(a, h.cx, h.cy));
  const bombs = stepBombs({
    ...state,
    tiles,
    holes: aged.filter((h) => h.age < HOLE_LIFETIME),
    rubble,
    laid,
  });
  tiles = bombs.tiles;
  const kept = bombs.holes;
  const { craters } = bombs;
  rubble = stepRubble({ ...state, tiles, holes: kept, craters, monks, rubble: bombs.rubble });
  // Rubble crushes while it falls, and on the tick it lands.
  const falling = rubble.filter((r) => r.landed <= 0);
  const crushed = (a: Actor): boolean => !inTransit(a) && falling.some((r) => rubbleHits(r, a));
  monks = monks.map((m) =>
    m.mode !== "dead" && (buried(m) || crushed(m) || bombs.kills(m))
      ? { ...m, mode: "dead", timer: MONK_TICKS.respawn, holeX: -1, holeY: -1 }
      : m,
  );
  const solo = players.length === 1;
  let died = false;
  // A won level ends as it is: nobody dies on the winning tick (a hole filling under
  // the winner would otherwise remove it from `playersAtExit`).
  const final = players.map((p, i) => {
    if (
      won ||
      p.mode !== "alive" ||
      !(caught[i] === true || buried(p) || crushed(p) || bombs.kills(p))
    ) {
      return p;
    }
    died = true;
    return die(p, solo);
  });
  let status: GameState["status"] = "playing";
  if (won) status = "won";
  else if (solo ? died : final.every((p) => p.mode === "out")) status = "dead";
  return {
    ...state,
    tick,
    rng,
    tiles,
    goldLeft,
    players: final,
    monks,
    holes: kept,
    rubble,
    craters,
    fuses: bombs.fuses,
    blasts: bombs.blasts,
    snares,
    clouds,
    status,
  };
}

/**
 * The players in play touching the open exit (indices, in player order). The tick this
 * becomes non-empty, the level is won; since a won state is frozen, on a won state it
 * still names the winners: one player, or both when they reached an exit on the same
 * tick (a draw in versus). Exits are not owned: in versus, a player may leave by any.
 */
export function playersAtExit(s: Pick<GameState, "tiles" | "goldLeft" | "players">): number[] {
  if (s.goldLeft !== 0) return [];
  const out: number[] = [];
  s.players.forEach((p, i) => {
    if (p.mode !== "alive") return;
    const { cx, cy } = centerCell(p);
    if (s.tiles[cy]?.charAt(cx) === TILE.exit) out.push(i);
  });
  return out;
}

/**
 * A player dies: it loses one of its own lives, and is out at 0. In a two-player game
 * it waits `PLAYER_RESPAWN_TICKS`, then reappears at its start while the other plays
 * on; in a one-player game the death ends the level instead (the session restarts it).
 */
function die(p: Player, solo: boolean): Player {
  const lives = p.lives - 1;
  const reset = { busy: 0, drill: false, hidden: false };
  if (lives <= 0) return { ...p, lives: 0, mode: "out", timer: 0, ...reset };
  const timer = solo ? 0 : PLAYER_RESPAWN_TICKS;
  return { ...p, lives, mode: "dead", timer, ...reset };
}

/**
 * One player's own action this tick: dig, move, or count down to reappearing.
 * `anyAlive`: some player was in play, and not hiding, at the start of the tick.
 */
function actPlayer(
  t: Terrain,
  p: Player,
  input: PlayerInput,
  tick: number,
  anyAlive: boolean,
): { player: Player; hole: Hole | null } {
  switch (p.mode) {
    case "out":
      return { player: p, hole: null };
    case "dead": {
      if (p.timer > 1) return { player: { ...p, timer: p.timer - 1 }, hole: null };
      // A monk on the start, even partly: wait until it leaves. Only while another
      // player is in play and in sight: with nobody to chase, monks stand still and
      // never would.
      const cx = cellOf(p.startX);
      const cy = cellOf(p.startY);
      // A snared monk never leaves, and is not a body: it does not block.
      const onStart = (m: Monk): boolean =>
        m.mode !== "dead" && m.mode !== "snared" && !inTransit(m) && overlapsCell(m, cx, cy);
      if (anyAlive && t.monks.some(onStart)) {
        return { player: p, hole: null };
      }
      const back: Player = { ...p, x: p.startX, y: p.startY, facing: 1, mode: "alive", timer: 0 };
      return { player: back, hole: null };
    }
    case "alive": {
      // In a teleporter: waits at the exit until it appears.
      if (inTransit(p)) return { player: { ...p, warp: p.warp - 1 }, hole: null };
      if (p.busy > 0) return { player: { ...p, busy: p.busy - 1 }, hole: null };
      const hide = tryHide(t, p, input);
      if (hide !== null) return { player: hide, hole: null };
      const dig = tryDig(t, p, input);
      if (dig !== null) return { player: { ...p, ...dig.runner }, hole: dig.hole };
      return { player: { ...p, ...stepActor(t, p, input, tick, RUNNER_PERIOD) }, hole: null };
    }
  }
}

/**
 * Hiding in an alcove (Guillaume, 2026-10-30): a player standing with its centre in an
 * alcove hides there by pressing up (it snaps onto the cell), and comes out by pressing
 * down. While hidden it does nothing else (no moving, digging or items) and monks
 * neither see nor catch it (`monks.ts`, `inSight`); it comes out by itself if the
 * alcove is destroyed. Returns the player's new state when hiding decides this tick,
 * else null (the player acts as usual).
 */
function tryHide(t: Terrain, p: Player, input: PlayerInput): Player | null {
  const { cx, cy } = centerCell(p);
  const inAlcove = t.tiles[cy]?.charAt(cx) === TILE.alcove;
  if (p.hidden) return input.down || !inAlcove ? { ...p, hidden: false } : p;
  if (!input.up || !inAlcove || isFalling(t, p)) return null;
  const snapped: Player = { ...p, x: cx * SUB, y: cy * SUB };
  if (isFalling(t, snapped)) return null;
  return { ...snapped, hidden: true };
}

/**
 * Digs the brick diagonally below on the given side. The player digs from the cell
 * nearest to it and snaps onto it, since walking or climbing usually stops between two
 * tiles. It must not be falling; standing on a ladder or hanging on a bar is fine. The
 * target must be an undug brick whose cell above is empty, the exit, or holds gold
 * (TLR allows digging under gold; the gold stays where it is). A brick, ladder, bar or monk above
 * blocks; another player does not.
 */
function tryDig(t: Terrain, a: Actor, input: PlayerInput): { runner: Actor; hole: Hole } | null {
  if (input.digLeft === input.digRight) return null;
  const dir: Facing = input.digLeft ? -1 : 1;
  if (isFalling(t, a)) return null;
  const cx = cellOf(a.x + SUB / 2);
  const cy = cellOf(a.y + SUB / 2);
  const snapped: Actor = { ...a, x: cx * SUB, y: cy * SUB };
  if (isFalling(t, snapped)) return null;
  const tx = cx + dir;
  const ty = cy + 1;
  if (tileAt(t, tx, ty) !== TILE.brick || holeAt(t.holes, tx, ty) !== undefined) return null;
  const above = tileAt(t, tx, cy);
  // The exit counts as empty: it is not there until the gold is gone, and passable after.
  if (above !== TILE.empty && above !== TILE.gold && above !== TILE.exit) return null;
  // A monk standing over the target blocks it (1982 rule).
  if (monkAt(t, tx, cy)) return null;
  return {
    runner: { ...snapped, facing: dir, busy: HOLE_TICKS.digging },
    hole: { cx: tx, cy: ty, age: 0 },
  };
}
