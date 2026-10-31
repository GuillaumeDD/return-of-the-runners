import { describe, expect, it } from "vitest";
import { TILE } from "../../src/level/format";
import { HOLE_LIFETIME } from "../../src/sim/holes";
import { NO_INPUT, type PlayerInput } from "../../src/sim/input";
import { PLAYER_RESPAWN_TICKS, START_LIVES, SUB } from "../../src/sim/rules";
import { countGold } from "../../src/sim/gold";
import type { GameState } from "../../src/sim/state";
import { playersAtExit, step } from "../../src/sim/step";
import { makeRng, randInt } from "../helpers/rng";
import { p1, press, stateFrom, withPlayer } from "./helpers";

// Versus plays by the co-op rules (shared gold, any exit, holes bury either player):
// these tests cover what a race needs on top of them.

const p2 = (s: GameState) => p1(s, 1);

function runBoth(s: GameState, a: PlayerInput, b: PlayerInput, ticks: number): GameState {
  let out = s;
  for (let i = 0; i < ticks; i++) out = step(out, [a, b]);
  return out;
}

/** Steps until the game ends (or `max` ticks), each player holding its input. */
function runUntilOver(s: GameState, a: PlayerInput, b: PlayerInput, max = 600): GameState {
  let out = s;
  for (let i = 0; i < max && out.status === "playing"; i++) out = step(out, [a, b]);
  return out;
}

/** A mirrored race: each player has one gold, then an exit, on its own side. */
const race = ["P.$.E..E.$.Q", "############"];

describe("versus: gold", () => {
  it("gold goes to the player that collects it", () => {
    const s = stateFrom(race, 1, 2);
    const a = runBoth(s, press.right, NO_INPUT, 30);
    expect([p1(a).gold, p2(a).gold, a.goldLeft]).toEqual([1, 0, 1]);
    const b = runBoth(a, NO_INPUT, press.left, 30);
    expect([p1(b).gold, p2(b).gold, b.goldLeft]).toEqual([1, 1, 0]);
  });

  // Randomized: random two-player levels with monks (which pick up and drop gold) and
  // random inputs. The gold left (carried by monks included) plus every player's own
  // count is the level's gold, on every tick; a player's count never goes down.
  // About 2.5 s locally, and over Vitest's 5 s default on CI runners (#57, #64): the
  // 30 s timeout at the end gives it room without cutting trials (B-047).
  it("the total never changes: goldLeft + each player's gold = the level's gold", () => {
    const rng = makeRng(2101);
    const tiles = "....####H-$$M";
    for (let trial = 0; trial < 60; trial++) {
      const w = 6 + randInt(rng, 7);
      const h = 4 + randInt(rng, 4);
      const rows: string[][] = [];
      for (let y = 0; y < h - 1; y++) {
        rows.push(Array.from({ length: w }, () => tiles.charAt(randInt(rng, tiles.length))));
      }
      rows.push(Array.from({ length: w }, () => TILE.bedrock));
      const put = (tile: string): void => {
        const y = randInt(rng, h - 1);
        const x = randInt(rng, w);
        const row = rows[y];
        if (row === undefined) return;
        if (row[x] === TILE.runnerStart || row[x] === TILE.player2Start) put(tile);
        else row[x] = tile;
      };
      put(TILE.runnerStart);
      put(TILE.player2Start);
      const grid = rows.map((r) => r.join(""));
      let s = stateFrom(grid, trial + 1, 2);
      const total = countGold(s.tiles);
      expect(s.goldLeft).toBe(total);
      const controls: PlayerInput[] = [
        NO_INPUT,
        press.left,
        press.right,
        press.up,
        press.down,
        { ...NO_INPUT, digLeft: true },
        { ...NO_INPUT, digRight: true },
      ];
      const pick = (): PlayerInput => controls[randInt(rng, controls.length)] ?? NO_INPUT;
      let a = pick();
      let b = pick();
      for (let t = 0; t < 900 && s.status === "playing"; t++) {
        if (randInt(rng, 20) === 0) a = pick();
        if (randInt(rng, 20) === 0) b = pick();
        const next = step(s, [a, b]);
        const why = `trial ${String(trial)} tick ${String(next.tick)}: ${grid.join("/")}`;
        expect(next.goldLeft + p1(next).gold + p2(next).gold, why).toBe(total);
        expect(p1(next).gold, why).toBeGreaterThanOrEqual(p1(s).gold);
        expect(p2(next).gold, why).toBeGreaterThanOrEqual(p2(s).gold);
        s = next;
      }
    }
  }, 30_000);
});

describe("versus: the race to the exit", () => {
  it("no player is at an open exit while gold is left, even standing on one", () => {
    const s = stateFrom(race, 1, 2);
    // Player 1 runs past its gold onto its exit; player 2's gold is still there.
    const a = runBoth(s, press.right, NO_INPUT, 64);
    expect(p1(a).x).toBe(4 * SUB);
    expect(a.goldLeft).toBe(1);
    expect(playersAtExit(a)).toEqual([]);
    expect(a.status).toBe("playing");
  });

  it("the first player to reach an exit wins, and the level ends on that tick", () => {
    const s = stateFrom(race, 1, 2);
    // Player 2 sets off 8 ticks late: same path, so player 1 is first.
    const late = runBoth(s, press.right, NO_INPUT, 8);
    const end = runUntilOver(late, press.right, press.left);
    expect(end.status).toBe("won");
    expect(playersAtExit(end)).toEqual([0]);
    // The tick before, nobody was out.
    const before = runBoth(late, press.right, press.left, end.tick - late.tick - 1);
    expect(before.status).toBe("playing");
    // The state is frozen: the loser does not get out afterwards.
    const after = runBoth(end, press.right, press.left, 60);
    expect(after.players).toEqual(end.players);
    expect(playersAtExit(after)).toEqual([0]);
  });

  it("player 2 wins the same way", () => {
    const s = stateFrom(race, 1, 2);
    const late = runBoth(s, NO_INPUT, press.left, 8);
    const end = runUntilOver(late, press.right, press.left);
    expect(end.status).toBe("won");
    expect(playersAtExit(end)).toEqual([1]);
  });

  it("both reaching an exit on the same tick is a draw", () => {
    // Both run right: on the mirrored race, running left takes one sub-unit more to
    // touch a cell (see the BACKLOG item on touch symmetry), so it would not be a draw.
    const end = runUntilOver(
      stateFrom(["P$E...Q$E...", "############"], 1, 2),
      press.right,
      press.right,
    );
    expect(end.status).toBe("won");
    expect(playersAtExit(end)).toEqual([0, 1]);
  });

  // Regression (self-review): a hole filling on the winning tick buried the winner,
  // who then dropped out of playersAtExit, and the banner named the other player.
  it("nobody dies on the tick the level is won, so the winner stays named", () => {
    // Player 2 climbs out of the hole at (2, 1) onto the exit at (3, 1) as it fills.
    let s = stateFrom(["P......Q", "..#E....", "########"], 1, 2);
    s = withPlayer({ ...s, goldLeft: 0 }, { x: 2 * SUB + SUB / 2, y: SUB }, 1);
    s = { ...s, holes: [{ cx: 2, cy: 1, age: HOLE_LIFETIME - 1 }] };
    const end = step(s, [NO_INPUT, NO_INPUT]);
    expect(end.status).toBe("won");
    expect(playersAtExit(end)).toEqual([1]);
    expect(p2(end)).toMatchObject({ mode: "alive", lives: START_LIVES });
    // The hole still closes.
    expect(end.holes).toEqual([]);
  });

  it("any exit will do: exits belong to no player", () => {
    // Player 2 never moves; player 1 takes both gold and leaves by player 2's exit.
    const s = stateFrom(["P.$..$.E.Q", "##########"], 1, 2);
    const end = runUntilOver(s, press.right, NO_INPUT);
    expect(playersAtExit(end)).toEqual([0]);
    expect([p1(end).gold, p2(end).gold]).toEqual([2, 0]);
  });
});

describe("versus: burying the other player", () => {
  it("a player can dig under the other: it falls in and dies when the hole fills", () => {
    // Player 1 digs the brick right of it, under player 2.
    const s = stateFrom(["..PQ....", "########", "@@@@@@@@"], 1, 2);
    let t = step(s, [{ ...NO_INPUT, digRight: true }, NO_INPUT]);
    expect(t.holes.map((h) => [h.cx, h.cy])).toEqual([[3, 1]]);
    // Player 2 drops into the hole and cannot get out, whatever it presses.
    const tries = [press.left, press.right, press.up];
    for (let i = 0; i < HOLE_LIFETIME - 2; i++) {
      t = step(t, [NO_INPUT, tries[i % tries.length] ?? NO_INPUT]);
      expect(p2(t).mode).toBe("alive");
    }
    expect([p2(t).x, p2(t).y]).toEqual([3 * SUB, SUB]);
    t = step(t, [NO_INPUT, NO_INPUT]);
    expect(p2(t)).toMatchObject({ mode: "dead", lives: START_LIVES - 1 });
    expect(p1(t)).toMatchObject({ mode: "alive", lives: START_LIVES });
    expect(t.status).toBe("playing");
    // It reappears at its start, which is solid brick again.
    t = runBoth(t, NO_INPUT, NO_INPUT, PLAYER_RESPAWN_TICKS);
    expect(p2(t)).toMatchObject({ mode: "alive", x: 3 * SUB, y: 0 });
  });

  it("a player that walks into the other's open hole is buried the same way", () => {
    // Player 2 digs left, then player 1 walks into the hole.
    const s = stateFrom(["P..Q....", "########", "@@@@@@@@"], 1, 2);
    let t = step(s, [NO_INPUT, { ...NO_INPUT, digLeft: true }]);
    expect(t.holes.map((h) => [h.cx, h.cy])).toEqual([[2, 1]]);
    t = runBoth(t, press.right, NO_INPUT, 40);
    expect([p1(t).x, p1(t).y]).toEqual([2 * SUB, SUB]);
    t = runBoth(t, press.right, NO_INPUT, HOLE_LIFETIME);
    expect(p1(t).lives).toBe(START_LIVES - 1);
    expect(p2(t).lives).toBe(START_LIVES);
  });
});
