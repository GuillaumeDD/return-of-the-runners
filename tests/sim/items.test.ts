import { describe, expect, it } from "vitest";
import { TILE } from "../../src/level/format";
import { NO_INPUT, type PlayerInput } from "../../src/sim/input";
import { isDoor, isItem } from "../../src/sim/items";
import { HOLE_TICKS, SUB } from "../../src/sim/rules";
import { newMonk, type GameState } from "../../src/sim/state";
import { step } from "../../src/sim/step";
import { makeRng, randInt } from "../helpers/rng";
import { atCell, cell, p1, press, run, stateFrom, stepOne, withPlayer } from "./helpers";

const take: PlayerInput = { ...NO_INPUT, pickUp: true };
const at = (s: GameState, cx: number, cy: number): string => s.tiles[cy]?.charAt(cx) ?? "";

/** A press of the pick-up key: one tick held, one released. */
function press1(s: GameState): GameState {
  return stepOne(stepOne(s, take), NO_INPUT);
}

describe("the item slot", () => {
  it("pick up into an empty slot: the key leaves its cell", () => {
    const s = atCell(stateFrom(["P.a..", "@@@@@"]), 2, 0);
    const t = stepOne(s, take);
    expect(p1(t).item).toBe(TILE.keyRed);
    expect(at(t, 2, 0)).toBe(TILE.empty);
  });

  it("pick up while holding swaps the two items in place", () => {
    let s = atCell(stateFrom(["P.b..", "@@@@@"]), 2, 0);
    s = withPlayer(s, { item: TILE.keyRed });
    const t = stepOne(s, take);
    expect(p1(t).item).toBe(TILE.keyGreen);
    expect(at(t, 2, 0)).toBe(TILE.keyRed);
  });

  it("on an empty cell, the key drops the held item; with nothing held, nothing happens", () => {
    let s = atCell(stateFrom(["P....", "@@@@@"]), 3, 0);
    expect(stepOne(s, take).tiles).toEqual(s.tiles);
    s = withPlayer(s, { item: TILE.keyBlue });
    const t = stepOne(s, take);
    expect(p1(t).item).toBe("");
    expect(at(t, 3, 0)).toBe(TILE.keyBlue);
  });

  it("drop needs an empty cell: not on a ladder, a bar, gold or the exit", () => {
    for (const tile of [TILE.ladder, TILE.bar, TILE.gold, TILE.exit]) {
      let s = atCell(stateFrom([`P..${tile}.`, "@@@@@"]), 3, 0);
      s = withPlayer(s, { item: TILE.keyRed });
      const t = stepOne(s, take);
      expect(p1(t).item, tile).toBe(TILE.keyRed);
      expect(at(t, 3, 0), tile).not.toBe(TILE.keyRed);
    }
  });

  it("acts once per press: holding the key does not swap back and forth", () => {
    let s = atCell(stateFrom(["P.a..", "@@@@@"]), 2, 0);
    for (let i = 0; i < 30; i++) s = stepOne(s, take);
    expect(p1(s).item).toBe(TILE.keyRed);
    expect(at(s, 2, 0)).toBe(TILE.empty);
    // Released, then pressed again: it drops.
    s = press1(stepOne(s, NO_INPUT));
    expect(p1(s).item).toBe("");
    expect(at(s, 2, 0)).toBe(TILE.keyRed);
  });

  it("works on the cell holding the player's centre, aligned or not", () => {
    // Just past the middle of the key's cell, walking right.
    const s = withPlayer(stateFrom(["P.a..", "@@@@@"]), { x: 2 * SUB + SUB / 2 - 1 });
    expect(p1(stepOne(s, take)).item).toBe(TILE.keyRed);
    const far = withPlayer(stateFrom(["P.a..", "@@@@@"]), { x: SUB + SUB / 2 - 1 });
    expect(p1(stepOne(far, take)).item).toBe("");
  });

  it("not while digging, nor in a teleporter, nor while dead", () => {
    // Digging: the press lands on the first tick of the dig.
    const s = atCell(
      stateFrom(["..a..", "#####", "@@@@@"].map((r, y) => (y === 0 ? "P" + r.slice(1) : r))),
      2,
      0,
    );
    const digging = stepOne(s, { ...take, digRight: true });
    expect(p1(digging).busy).toBe(HOLE_TICKS.digging);
    expect(p1(digging).item).toBe("");
    // In transit.
    const warped = withPlayer(atCell(stateFrom(["P.a..", "@@@@@"]), 2, 0), { warp: 10 });
    expect(p1(stepOne(warped, take)).item).toBe("");
    // Dead (two-player game, waiting to reappear).
    const dead = withPlayer(atCell(stateFrom(["P.a.Q", "@@@@@"], 1, 2), 2, 0), {
      mode: "dead",
      timer: 50,
    });
    expect(p1(step(dead, [take, NO_INPUT])).item).toBe("");
  });

  it("keys are not solid and hold nothing up: the runner falls through one", () => {
    const s = stateFrom(["P...", "a...", "....", "@@@@"]);
    const t = run(s, press.none, 3 * SUB);
    expect(cell(t)).toEqual({ x: 0, y: 2 });
    expect(at(t, 0, 1)).toBe(TILE.keyRed); // not taken by passing through
  });

  it("a brick can be dug under a key, as under gold", () => {
    const s = stateFrom(["P.a.", "####", "@@@@"]);
    const t = atCell(s, 1, 0);
    expect(stepOne(t, { ...NO_INPUT, digRight: true }).holes).toHaveLength(1);
  });

  it("monks never take keys: they walk through them", () => {
    let s = stateFrom(["P..a..M", "@@@@@@@"]);
    s = { ...s, monks: [newMonk(6, 0)] };
    for (let i = 0; i < 600 && s.status === "playing"; i++) s = stepOne(s, press.none);
    expect(s.status).toBe("dead"); // caught: the monk walked the whole way
    expect(at(s, 3, 0)).toBe(TILE.keyRed);
  });

  it("a player who dies keeps its item while it waits to reappear", () => {
    let s = withPlayer(stateFrom(["P...Q", "@@@@@"], 1, 2), { item: TILE.keyRed });
    s = withPlayer(s, { mode: "dead", timer: 3 });
    s = step(step(step(s, []), []), []);
    expect(p1(s)).toMatchObject({ mode: "alive", item: TILE.keyRed });
  });
});

describe("items are never duplicated or lost", () => {
  // Randomized: random two-player levels with keys, doors and monks, and random inputs
  // (pick-up included). On every tick, the keys lying in the grid, plus those held, plus
  // the doors opened (each uses one key up), is the level's key count, per colour. So
  // the 1994 duplication bug (S-005) is not reproduced.
  it("1,000 random levels keep each key colour's count", { timeout: 60_000 }, () => {
    const rng = makeRng(2401);
    const tiles = "....###H-$$abcABCM";
    const colours = [
      [TILE.keyRed, TILE.doorRed],
      [TILE.keyGreen, TILE.doorGreen],
      [TILE.keyBlue, TILE.doorBlue],
    ] as const;
    const count = (s: GameState, key: string, door: string, doors0: number): number => {
      const grid = s.tiles.join("");
      const lying = grid.split(key).length - 1;
      const held = s.players.filter((p) => p.item === key).length;
      const opened = doors0 - (grid.split(door).length - 1);
      return lying + held + opened;
    };
    const doors = (g: GameState): number => g.tiles.join("").split("").filter(isDoor).length;
    let swaps = 0;
    let opens = 0;
    for (let trial = 0; trial < 1000; trial++) {
      const w = 6 + randInt(rng, 5);
      const h = 4 + randInt(rng, 3);
      const rows: string[][] = [];
      for (let y = 0; y < h - 1; y++) {
        rows.push(Array.from({ length: w }, () => tiles.charAt(randInt(rng, tiles.length))));
      }
      rows.push(Array.from({ length: w }, () => TILE.bedrock));
      const put = (tile: string): void => {
        for (;;) {
          const row = rows[randInt(rng, h - 1)];
          const x = randInt(rng, w);
          if (row !== undefined && row[x] !== TILE.runnerStart && row[x] !== TILE.player2Start) {
            row[x] = tile;
            return;
          }
        }
      };
      put(TILE.runnerStart);
      put(TILE.player2Start);
      const grid = rows.map((r) => r.join(""));
      let s = stateFrom(grid, trial + 1, 2);
      const start = colours.map(([key, door]) => {
        const doors = s.tiles.join("").split(door).length - 1;
        return { key, door, doors, total: count(s, key, door, doors) };
      });
      const controls: PlayerInput[] = [
        NO_INPUT,
        press.left,
        press.right,
        press.up,
        press.down,
        take,
        take,
        { ...NO_INPUT, digLeft: true },
      ];
      const pick = (): PlayerInput => controls[randInt(rng, controls.length)] ?? NO_INPUT;
      let a = pick();
      let b = pick();
      for (let t = 0; t < 150 && s.status === "playing"; t++) {
        if (randInt(rng, 6) === 0) a = pick();
        if (randInt(rng, 6) === 0) b = pick();
        const next = step(s, [a, b]);
        const why = (): string =>
          `trial ${String(trial)} tick ${String(next.tick)}: ${grid.join("/")}`;
        // Plain checks first: an expect per tick would make this test slow.
        for (const c of start) {
          const n = count(next, c.key, c.door, c.doors);
          if (n !== c.total) expect(n, why()).toBe(c.total);
        }
        for (const p of next.players) {
          if (p.item !== "" && !isItem(p.item)) expect(p.item, why()).toBe("an item");
        }
        next.players.forEach((p, i) => {
          const before = s.players[i];
          if (before !== undefined && before.item !== "" && p.item !== "" && p.item !== before.item)
            swaps++;
        });
        if (next.tiles !== s.tiles && doors(next) < doors(s)) opens++;
        s = next;
      }
    }
    // The test does exercise swaps and doors.
    expect(swaps).toBeGreaterThan(10);
    expect(opens).toBeGreaterThan(10);
  });
});
