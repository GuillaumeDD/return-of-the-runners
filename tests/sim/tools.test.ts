import { describe, expect, it } from "vitest";
import { TILE } from "../../src/level/format";
import { NO_INPUT, type PlayerInput } from "../../src/sim/input";
import { respawnCell } from "../../src/sim/monks";
import { DRILL_TICKS, HOLE_TICKS, PICK_TICKS, RUBBLE_TICKS, SUB } from "../../src/sim/rules";
import { newMonk, type GameState } from "../../src/sim/state";
import { step } from "../../src/sim/step";
import { rubbleAt, stepRubble, type Rubble } from "../../src/sim/tools";
import { cell, p1, press, run, stateFrom, stepOne, withPlayer } from "./helpers";

const use: PlayerInput = { ...NO_INPUT, use: true };
const holding = (s: GameState, item: string): GameState => withPlayer(s, { item });
const holesOf = (s: GameState): number[][] => s.holes.map((h) => [h.cx, h.cy]);

/** A press of the use key: one tick held, one released. */
function press1(s: GameState): GameState {
  return stepOne(stepOne(s, use), NO_INPUT);
}

describe("using an item", () => {
  it("an empty slot or a key does nothing", () => {
    for (const item of ["", TILE.keyRed, TILE.keyBlue]) {
      const s = holding(stateFrom(["P...", "#...", "@@@@"]), item);
      const t = stepOne(s, use);
      expect(t.holes, item).toEqual([]);
      expect(t.rubble, item).toEqual([]);
      expect(t.tiles, item).toEqual(s.tiles);
      expect({ ...p1(t), useHeld: false }, item).toEqual(p1(s));
    }
  });

  it("not while falling", () => {
    for (const item of [TILE.jackhammer, TILE.pickaxe]) {
      const s = holding(stateFrom(["P...", "....", "#...", "@@@@"]), item);
      const t = stepOne(withPlayer(s, { y: 2 }), use);
      expect([t.holes, t.rubble], item).toEqual([[], []]);
    }
  });

  // Regression (self-review): the player was snapped over the gap, as digging is not.
  it("not from a ledge where the nearest cell is over a gap", () => {
    for (const item of [TILE.jackhammer, TILE.pickaxe]) {
      const s = withPlayer(stateFrom(["P..", "@.@", "@@@"]), { item, x: SUB / 2 + 1 });
      const t = stepOne(s, use);
      expect([t.holes, t.rubble, p1(t).busy], item).toEqual([[], [], 0]);
    }
  });

  it("tools are never used up, and act once per press", () => {
    let s = holding(stateFrom(["P....", "@@@@@"]), TILE.pickaxe);
    for (let i = 0; i < PICK_TICKS * 3; i++) s = stepOne(s, use);
    expect(s.rubble).toHaveLength(1);
    expect(p1(s).item).toBe(TILE.pickaxe);
    // Released and pressed again, from a cell with room in front.
    s = withPlayer(stepOne(s, NO_INPUT), { facing: -1, x: 3 * SUB });
    s = press1(s);
    expect(s.rubble.map((r) => r.cx)).toEqual([1, 2]);
  });
});

describe("the jackhammer", () => {
  it("drills brick and bedrock straight down while the use key is held, until it cannot", () => {
    // Brick, then bedrock, then a ladder: drills two cells, stops on the ladder.
    let s = holding(stateFrom(["P...", "#...", "@...", "H...", "@@@@"]), TILE.jackhammer);
    s = stepOne(s, use);
    expect(holesOf(s)).toEqual([[0, 1]]);
    expect(p1(s)).toMatchObject({ busy: DRILL_TICKS, drill: true });
    // Still on top while the cell opens: no moving meanwhile.
    s = run(s, { ...use, right: true }, DRILL_TICKS - 1);
    expect(cell(s)).toEqual({ x: 0, y: 0 });
    s = run(s, use, 2 * DRILL_TICKS + 3 * SUB);
    expect(holesOf(s)).toEqual([
      [0, 1],
      [0, 2],
    ]);
    expect(cell(s)).toEqual({ x: 0, y: 2 });
    expect(p1(s)).toMatchObject({ drill: false, item: TILE.jackhammer });
  });

  // Regression (Guillaume's playtest, B-040): one press drilled down to the bottom.
  it("stops when the use key is let go: the cell stays solid and the player is free", () => {
    let s = holding(stateFrom(["P...", "#...", "#...", "@@@@"]), TILE.jackhammer);
    s = run(s, use, DRILL_TICKS / 2);
    expect(p1(s).drill).toBe(true);
    s = stepOne(s, press.right);
    expect(s.holes).toEqual([]);
    expect(p1(s)).toMatchObject({ busy: 0, drill: false });
    // It walks off at once, and the brick it stood on is whole.
    s = run(s, press.right, SUB);
    expect(p1(s).x).toBeGreaterThan(0);
    expect(s.tiles[1]).toBe("#...");
  });

  it("a cell opened, the player falls in and drills no further once the key is let go", () => {
    let s = holding(stateFrom(["P...", "#...", "#...", "#...", "@@@@"]), TILE.jackhammer);
    s = run(s, use, DRILL_TICKS + 1);
    s = run(s, NO_INPUT, 2 * DRILL_TICKS);
    expect(holesOf(s)).toEqual([[0, 1]]);
    expect(cell(s)).toEqual({ x: 0, y: 1 });
    // Held again, it drills on from there.
    s = stepOne(s, use);
    expect(holesOf(s)).toEqual([
      [0, 1],
      [0, 2],
    ]);
  });

  it("held while walking, it drills as soon as the player is over a drillable cell", () => {
    // A door below the start cannot be drilled; the brick next to it can.
    let s = holding(stateFrom(["P...", "A#@@", "@@@@"]), TILE.jackhammer);
    s = run(s, use, 3);
    expect(s.holes).toEqual([]);
    s = run(s, { ...use, right: true }, 5 * SUB);
    expect(holesOf(s)).toEqual([[1, 1]]);
    expect(cell(s)).toEqual({ x: 1, y: 0 });
  });

  // Regression (self-review): a player who dropped the jackhammer went on drilling.
  it("stops drilling when the jackhammer is dropped", () => {
    let s = holding(stateFrom(["P...", "#...", "#...", "#...", "@@@@"]), TILE.jackhammer);
    // Pressed on the tick the first cell opens, the player no longer busy.
    s = run(s, use, DRILL_TICKS);
    s = stepOne(s, { ...use, pickUp: true });
    expect(s.tiles[0]?.charAt(0)).toBe(TILE.jackhammer);
    // It falls into the open cell and stays there, the key still held: no second cell.
    s = run(s, use, 2 * DRILL_TICKS);
    expect(holesOf(s)).toEqual([[0, 1]]);
    expect(cell(s)).toEqual({ x: 0, y: 1 });
    expect(p1(s)).toMatchObject({ drill: false, item: "" });
  });

  it("does not drill a ladder, a door, gooey turf or the level's edge", () => {
    for (const below of [TILE.ladder, TILE.doorRed, TILE.gooeyTurf, TILE.empty]) {
      const s = holding(stateFrom(["P..", `${below}..`, "@@@"]), TILE.jackhammer);
      const t = run(s, use, 2);
      expect(t.holes, below).toEqual([]);
      expect(p1(t).drill, below).toBe(false);
    }
    // The bottom row: nothing below it to drill into.
    const bottom = holding(stateFrom(["...", "P.."]), TILE.jackhammer);
    expect(stepOne(bottom, use).holes).toEqual([]);
  });

  it("a monk on the cell below blocks the drill", () => {
    let s = holding(stateFrom(["P..", "#..", "@@@"]), TILE.jackhammer);
    s = { ...s, monks: [{ ...newMonk(0, 1), mode: "trapped", holeX: 0, holeY: 1 }] };
    expect(stepOne(s, use).holes).toEqual([]);
  });

  it("the shaft refills behind like a dug hole: whoever is still in it dies", () => {
    // One cell of bedrock over the floor: the player drills it and stays in it.
    let s = holding(stateFrom(["P..", "@..", "@@@"]), TILE.jackhammer);
    s = run(run(s, use, DRILL_TICKS + 1), press.none, 600);
    expect(s.status).toBe("dead");
    expect(s.holes).toEqual([]);
    expect(s.tiles[1]).toBe("@..");
  });
});

describe("the pickaxe", () => {
  // Regression (Guillaume's playtest, B-042): the pickaxe worked under open sky.
  it("works only under a ceiling: a solid cell above the cell in front", () => {
    // Open air above the cell in front: nothing happens.
    const open = holding(stateFrom(["....", "P...", "@@@@"]), TILE.pickaxe);
    const none = stepOne(open, use);
    expect([none.rubble, p1(none).busy]).toEqual([[], 0]);
    // Brick, bedrock or the top of the level above it: rubble comes down.
    for (const top of ["#", "@"]) {
      const s = holding(stateFrom([`.${top}..`, "P...", "@@@@"]), TILE.pickaxe);
      expect(
        stepOne(s, use).rubble.map((r) => [r.cx, r.y]),
        top,
      ).toEqual([[1, SUB]]);
    }
    const edge = holding(stateFrom(["P...", "@@@@"]), TILE.pickaxe);
    expect(stepOne(edge, use).rubble).toHaveLength(1);
    // A ceiling brick dug open is no ceiling.
    const dug = holding(stateFrom(["P#..", "....", "@@@@"]), TILE.pickaxe);
    const opened = { ...dug, holes: [{ cx: 1, cy: 0, age: HOLE_TICKS.digging }] };
    expect(stepOne(withPlayer(dug, { y: SUB }), use).rubble).toHaveLength(1);
    expect(stepOne(withPlayer(opened, { y: SUB }), use).rubble).toEqual([]);
  });

  it("brings rubble down in front, which falls to the first support and lands", () => {
    let s = holding(stateFrom(["P...", "@...", "@...", "@#@@"]), TILE.pickaxe);
    s = stepOne(s, use);
    // It starts falling on the tick it appears, one sub-unit a tick.
    expect(s.rubble).toEqual([{ cx: 1, y: 1, landed: -1 }]);
    expect(p1(s).busy).toBe(PICK_TICKS);
    // Two cells down it rests on the brick, and lands the tick after.
    s = run(s, press.none, 2 * SUB);
    expect(s.rubble).toEqual([{ cx: 1, y: 2 * SUB, landed: 0 }]);
    expect(rubbleAt(s.rubble, 1, 2)).toBe(true);
  });

  it("needs an empty cell in front: not brick, a ladder, a bar, gold or an item", () => {
    for (const front of [TILE.brick, TILE.ladder, TILE.bar, TILE.gold, TILE.keyRed]) {
      const s = holding(stateFrom([`P${front}..`, "@@@@"]), TILE.pickaxe);
      expect(stepOne(s, use).rubble, front).toEqual([]);
    }
  });

  it("buries a monk standing right in front at once (S-021 @ 0:08)", () => {
    let s = holding(stateFrom(["P.M", "@@@"]), TILE.pickaxe);
    s = { ...s, monks: [newMonk(1, 0)] };
    s = stepOne(s, use);
    expect(s.monks[0]?.mode).toBe("dead");
    expect(s.status).toBe("playing");
  });

  // Regression (self-review): rubble landed in gold, an item or the exit and sealed it.
  it("rubble that comes to rest in gold, an item, the exit or a teleporter crumbles", () => {
    for (const tile of [TILE.gold, TILE.keyRed, TILE.exit, TILE.teleportEntrance]) {
      let s = holding(stateFrom(["P...", "@.@@", `@${tile}@@`, "@@@@"]), TILE.pickaxe);
      s = run(stepOne(s, use), NO_INPUT, 3 * SUB);
      expect(s.rubble, tile).toEqual([]);
      expect(s.tiles[2]?.charAt(1), tile).toBe(tile);
    }
    // Nor is it brought down in one.
    const s = holding(stateFrom(["PT..", "@@@@"]), TILE.pickaxe);
    expect(stepOne(s, use).rubble).toEqual([]);
  });

  it("swings the way the player faces", () => {
    const s = holding(stateFrom([".P..", "@@@@"]), TILE.pickaxe);
    expect(stepOne(withPlayer(s, { facing: -1 }), use).rubble.map((r) => r.cx)).toEqual([0]);
    expect(stepOne(s, use).rubble.map((r) => r.cx)).toEqual([2]);
  });

  it("landed rubble blocks the runner, then crumbles", () => {
    let s = holding(stateFrom(["P....", "@@@@@"]), TILE.pickaxe);
    s = run(stepOne(s, use), NO_INPUT, 2);
    s = run(s, press.right, 100);
    expect(cell(s)).toEqual({ x: 0, y: 0 });
    // Crumbles `RUBBLE_TICKS` after landing: the way is open.
    s = run(s, press.right, RUBBLE_TICKS);
    expect(s.rubble).toEqual([]);
    expect(cell(s).x).toBeGreaterThan(1);
  });

  it("landed rubble is a floor: the runner stands on it", () => {
    // Rubble lands on the floor beside a ledge, and the runner walks over it.
    let s = holding(stateFrom(["P..", "@..", "@.@", "@@@"]), TILE.pickaxe);
    s = run(stepOne(s, use), NO_INPUT, 2 * SUB + 2);
    expect(rubbleAt(s.rubble, 1, 2)).toBe(true);
    s = run(s, press.right, 40);
    expect(cell(s)).toEqual({ x: 2, y: 1 });
  });

  it("landed rubble blocks monks", () => {
    let s = holding(stateFrom(["P....M", "@@@@@@"]), TILE.pickaxe);
    s = { ...s, monks: [newMonk(5, 0)] };
    s = run(stepOne(s, use), NO_INPUT, 300);
    expect(s.status).toBe("playing");
    expect(s.monks[0]?.x).toBe(2 * SUB);
  });

  it("falling rubble crushes a monk it touches", () => {
    let s = holding(stateFrom(["P..", "@..", "@@@"]), TILE.pickaxe);
    s = { ...s, monks: [{ ...newMonk(1, 1), mode: "trapped", timer: 100, holeX: 1, holeY: 1 }] };
    s = run(stepOne(s, use), NO_INPUT, SUB);
    expect(s.monks[0]?.mode).toBe("dead");
  });

  it("falling rubble crushes a player it touches (provisional)", () => {
    let s = holding(stateFrom(["P..", "@Q.", "@@@"], 1, 2), TILE.pickaxe);
    for (let i = 0; i < SUB && p1(s, 1).mode === "alive"; i++) s = step(s, [use, NO_INPUT]);
    expect(p1(s, 1).mode).toBe("dead");
    expect(p1(s, 1).lives).toBe(p1(s, 0).lives - 1);
  });

  // Regression (self-review): an older piece just above a newer one fell into its cell.
  it("rubble falling on rubble that lands this tick stacks on it", () => {
    let s = stateFrom(["P...", "....", "....", "....", "@@@@"]);
    s = {
      ...s,
      rubble: [
        { cx: 1, y: SUB, landed: -1 },
        { cx: 1, y: 2 * SUB, landed: -1 },
      ],
    };
    let rubble: readonly Rubble[] = s.rubble;
    for (let i = 0; i < 2 * SUB; i++) rubble = stepRubble({ ...s, rubble });
    expect(rubble.map((r) => [r.cx, r.y / SUB, r.landed >= 0])).toEqual([
      [1, 2, true],
      [1, 3, true],
    ]);
  });

  // Regression (self-review): landed rubble floated over a hole opened under it.
  it("landed rubble falls again when a hole opens under it", () => {
    let s = stateFrom(["P...", "@#@@", "@@@@"]);
    s = { ...s, holes: [{ cx: 1, cy: 1, age: HOLE_TICKS.digging }] };
    let rubble: readonly Rubble[] = [{ cx: 1, y: 0, landed: 5 }];
    rubble = stepRubble({ ...s, rubble });
    expect(rubble).toEqual([{ cx: 1, y: 1, landed: -1 }]);
    for (let i = 0; i < SUB; i++) rubble = stepRubble({ ...s, rubble });
    expect(rubble).toEqual([{ cx: 1, y: SUB, landed: 0 }]);
  });

  // Regression (self-review): a monk could reappear inside landed rubble.
  it("a dead monk does not reappear in rubble", () => {
    const s = stateFrom(["P###", "##.#", "@@@@"]);
    expect(respawnCell(s, s.players, 1).cell).toEqual({ cx: 2, cy: 1 });
    const covered = { ...s, rubble: [{ cx: 2, y: SUB, landed: 3 }] };
    expect(respawnCell(covered, s.players, 1).cell).toBeNull();
  });

  it("rubble in a hole goes when the hole refills", () => {
    // Dig, then drop rubble into the hole: it lands on the floor of the hole.
    let s = holding(stateFrom(["P...", "@#@@", "@@@@"]), TILE.pickaxe);
    s = stepOne(s, { ...NO_INPUT, digRight: true });
    s = run(s, NO_INPUT, 20);
    s = run(stepOne(s, use), NO_INPUT, 2 * SUB);
    expect(rubbleAt(s.rubble, 1, 1)).toBe(true);
    s = run(s, NO_INPUT, 300);
    expect(s.holes).toEqual([]);
    expect(s.rubble).toEqual([]);
  });
});
