import { describe, expect, it } from "vitest";
import { TILE } from "../../src/level/format";
import { NO_INPUT, type PlayerInput } from "../../src/sim/input";
import {
  GOO_CELLS,
  GOO_PERIOD,
  GOO_THROW_TICKS,
  HOLE_TICKS,
  MONK_PERIOD,
  SUB,
} from "../../src/sim/rules";
import type { GameState, Monk } from "../../src/sim/state";
import { p1, press, run, stateFrom, stepOne, withPlayer } from "./helpers";

const use: PlayerInput = { ...NO_INPUT, use: true };
const pick: PlayerInput = { ...NO_INPUT, pickUp: true };
const digRight: PlayerInput = { ...NO_INPUT, digRight: true };

/** A press of a key: one tick held, one released. */
function tap(s: GameState, input: PlayerInput): GameState {
  return stepOne(stepOne(s, input), NO_INPUT);
}

function monk(s: GameState, i = 0): Monk {
  const m = s.monks[i];
  if (m === undefined) throw new Error(`no monk ${String(i)}`);
  return m;
}

const bucket = (s: GameState): GameState => withPlayer(s, { item: TILE.gooBucket });

/** One throw, then the floor row (the row under the player). */
function thrown(rows: readonly string[], facing: -1 | 1 = 1): { s: GameState; floor: string } {
  const s = stepOne(withPlayer(bucket(stateFrom(rows)), { facing }), use);
  return { s, floor: s.tiles[rows.length - 1] ?? "" };
}

describe("the goo bucket", () => {
  it("is picked up into the item slot, and swapped like any item", () => {
    let s = stateFrom(["Pug.", "@@@@"]);
    s = run(s, press.right, 2 * 8);
    s = tap(s, pick);
    expect([p1(s).item, s.tiles[0]]).toEqual([TILE.gooBucket, "..g."]);
    s = run(s, press.right, 2 * 8);
    s = tap(s, pick);
    expect([p1(s).item, s.tiles[0]]).toEqual([TILE.gasSpray, "..u."]);
  });

  it(`turns the floor under the ${String(GOO_CELLS)} cells in front into gooey turf, and is used up`, () => {
    const { s, floor } = thrown(["P.......", "########"]);
    expect(floor).toBe("#~~~####");
    expect(p1(s).item).toBe("");
    expect(p1(s).busy).toBe(GOO_THROW_TICKS);
    // The player's own floor is untouched.
    expect(floor.charAt(0)).toBe(TILE.brick);
  });

  it("throws the way the player faces", () => {
    expect(thrown(["......P.", "########"], -1).floor).toBe("###~~~##");
  });

  it("covers bedrock and goo too", () => {
    expect(thrown(["P.......", "@@~#####"]).floor).toBe("@~~~####");
  });

  it("stays for the rest of the level", () => {
    const { s } = thrown(["P.......", "########"]);
    expect(run(s, press.none, 2000).tiles[1]).toBe("#~~~####");
  });

  it("stops at a wall or the level's edge", () => {
    expect(thrown(["P.#.....", "########"]).floor).toBe("#~######");
    expect(thrown(["....P.", "######"]).floor).toBe("#####~");
  });

  it("stops where the floor is not brick, bedrock or goo: a gap, a ladder, a door", () => {
    expect(thrown(["P.......", "##.#####"]).floor).toBe("#~.#####");
    expect(thrown(["P.......", "##H#####"]).floor).toBe("#~H#####");
    expect(thrown(["P.......", "##R#####"]).floor).toBe("#~R#####");
  });

  it("stops at a hole, even one still being dug, and does not fill it", () => {
    const open = stateFrom(["P.......", "########"]);
    const holed = { ...open, holes: [{ cx: 2, cy: 1, age: HOLE_TICKS.digging }] };
    const s = stepOne(bucket(holed), use);
    expect(s.tiles[1]).toBe("#~######");
    const digging = { ...open, holes: [{ cx: 1, cy: 1, age: 0 }] };
    const t = stepOne(bucket(digging), use);
    expect([t.tiles[1], p1(t).item]).toEqual(["########", TILE.gooBucket]);
  });

  it("is kept when nothing can take goo: against a wall, while falling, or busy", () => {
    const wall = thrown(["P#......", "########"]);
    expect([wall.floor, p1(wall.s).item, p1(wall.s).busy]).toEqual(["########", TILE.gooBucket, 0]);
    const falling = withPlayer(bucket(stateFrom(["P...", "....", "####"])), { y: 2 });
    const f = stepOne(falling, use);
    expect([f.tiles[2], p1(f).item]).toEqual(["####", TILE.gooBucket]);
    // Digging keeps the player busy: the use key does nothing meanwhile.
    let d = bucket(stateFrom(["P.......", "########"]));
    d = stepOne(d, digRight);
    d = stepOne(d, NO_INPUT);
    d = stepOne(d, use);
    expect(p1(d).busy).toBeGreaterThan(0);
    expect([d.tiles[1], p1(d).item]).toEqual(["########", TILE.gooBucket]);
  });

  it("does nothing with an empty slot, and only once per press", () => {
    const empty = stepOne(stateFrom(["P.......", "########"]), use);
    expect(empty.tiles[1]).toBe("########");
    let s = withPlayer(stateFrom(["P..u....", "########"]), { item: TILE.gooBucket });
    s = run(s, use, 3 * GOO_THROW_TICKS);
    expect([s.tiles[1], p1(s).item]).toEqual(["#~~~####", ""]);
  });

  it("slows the runner on it to GOO_PERIOD", () => {
    let s = thrown(["P.......", "########"]).s;
    s = run(s, press.none, GOO_THROW_TICKS);
    s = withPlayer(s, { x: 2 * SUB });
    // Measure a full period on the goo: from one step to the next.
    const steps: number[] = [];
    for (let t = 1; t <= 40; t++) {
      const x = p1(s).x;
      s = stepOne(s, press.right);
      if (p1(s).x !== x) steps.push(t);
    }
    expect(steps.slice(1).map((t, i) => t - (steps[i] ?? 0))).toEqual(
      Array.from({ length: steps.length - 1 }, () => GOO_PERIOD),
    );
  });

  it("slows a monk walking into it: it crosses 3 cells far slower than on brick", () => {
    const rows = ["P.........M", "###########"];
    const plain = run(stateFrom(rows), press.none, 3 * SUB * MONK_PERIOD.walk);
    let s = withPlayer(bucket(stateFrom(rows)), { x: 6 * SUB, facing: 1 });
    s = stepOne(s, use);
    expect(s.tiles[1]).toBe("#######~~~#");
    s = run(s, press.none, 3 * SUB * MONK_PERIOD.walk - 1);
    // On brick the monk covers 3 cells in that time; on goo, well under 2.
    expect(monk(plain).x).toBe(7 * SUB);
    expect(monk(s).x).toBeGreaterThan(8 * SUB);
  });

  it("cannot be dug, like any gooey turf (provisional)", () => {
    const { s } = thrown(["P.......", "########"]);
    const free = run(s, press.none, GOO_THROW_TICKS);
    const dug = stepOne(free, digRight);
    expect(dug.holes).toEqual([]);
  });
});
