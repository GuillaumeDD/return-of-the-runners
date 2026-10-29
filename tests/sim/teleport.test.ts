import { describe, expect, it } from "vitest";
import type { Teleport } from "../../src/level/format";
import { createState, newMonk, type GameState, type Monk } from "../../src/sim/state";
import { MONK_TICKS, SUB, TELEPORT_TICKS } from "../../src/sim/rules";
import { step } from "../../src/sim/step";
import { exitOf, inTransit, tryTeleport } from "../../src/sim/teleport";
import { makeRng, randInt } from "../helpers/rng";
import { cell, levelFrom, p1, press, run, stepOne, withPlayer } from "./helpers";

function withLinks(rows: readonly string[], teleports: Teleport[], players: 1 | 2 = 1): GameState {
  return createState({ ...levelFrom(rows), teleports }, 1, players);
}

function monk(s: GameState, i = 0): Monk {
  const m = s.monks[i];
  if (m === undefined) throw new Error(`no monk ${String(i)}`);
  return m;
}

/** Steps with `input` until the player is in transit (max 200 ticks); throws otherwise. */
function untilTransit(s: GameState, input = press.right): GameState {
  let out = s;
  for (let i = 0; i < 200; i++) {
    out = stepOne(out, input);
    if (inTransit(p1(out))) return out;
  }
  throw new Error("never teleported");
}

// Entrance at (2, 0), exit at (6, 0).
const corridor = ["P.T...t.", "@@@@@@@@"];
const corridorLink: Teleport[] = [[2, 0, 6, 0]];

describe("exitOf", () => {
  it("is the exit an entrance is linked to, or null", () => {
    const links: Teleport[] = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ];
    expect(exitOf(links, 5, 6)).toEqual({ cx: 7, cy: 8 });
    expect(exitOf(links, 3, 4)).toBeNull(); // an exit leads nowhere
    expect(exitOf([], 1, 2)).toBeNull();
  });
});

describe("a player in a teleporter", () => {
  it("on reaching the entrance, moves to the linked exit, in transit for TELEPORT_TICKS", () => {
    const s = untilTransit(withLinks(corridor, corridorLink));
    expect(p1(s)).toMatchObject({ x: 6 * SUB, y: 0, warp: TELEPORT_TICKS });
    // The tick before, it was just short of the entrance.
    const before = run(withLinks(corridor, corridorLink), press.right, s.tick - 1);
    expect(p1(before).x).toBeLessThan(2 * SUB);
  });

  it("waits at the exit, whatever it presses, then plays on", () => {
    let s = untilTransit(withLinks(corridor, corridorLink));
    for (let i = 1; i < TELEPORT_TICKS; i++) {
      s = stepOne(s, i % 2 === 0 ? press.left : press.right);
      expect(p1(s)).toMatchObject({ x: 6 * SUB, y: 0, warp: TELEPORT_TICKS - i });
    }
    s = stepOne(s, press.right);
    expect(p1(s).warp).toBe(0);
    expect(p1(s).x).toBe(6 * SUB); // the tick it appears, it does not move yet
    s = run(s, press.right, SUB * 2);
    expect(p1(s).x).toBeGreaterThan(6 * SUB);
  });

  it("an exit does nothing: walking over one, or onto an unlinked entrance", () => {
    // Walks left from the right end over the exit, to the wall, never in transit.
    let s = withLinks(["@.t..P", "@@@@@@"], []);
    for (let i = 0; i < 100; i++) {
      s = stepOne(s, press.left);
      expect(inTransit(p1(s))).toBe(false);
    }
    expect(cell(s)).toEqual({ x: 1, y: 0 }); // past the exit
    // An entrance with no link (only possible in a hand-built state) is plain empty.
    let u = withLinks(corridor, []);
    u = run(u, press.right, 100);
    expect(inTransit(p1(u))).toBe(false);
    expect(p1(u).x).toBeGreaterThan(2 * SUB);
  });

  it("falling onto an entrance teleports too", () => {
    const s = withLinks(["P...", "T..t", "@@@@"], [[0, 1, 3, 1]]);
    const t = run(s, press.none, SUB);
    expect(p1(t)).toMatchObject({ x: 3 * SUB, y: SUB });
    expect(inTransit(p1(t))).toBe(true);
  });

  it("does not pick up gold while in transit (and the exit cell holds none)", () => {
    const s = untilTransit(withLinks(["P.T.$.t.", "@@@@@@@@"], [[2, 0, 6, 0]]));
    const done = run(s, press.none, TELEPORT_TICKS);
    expect(done.goldLeft).toBe(1);
  });
});

describe("a monk on the exit", () => {
  // The monk is boxed in on the exit (bedrock on both sides), so it stays there.
  const boxed = ["P.T.@t@", "@@@@@@@"];

  it("delays the jump: a player standing on the entrance jumps once the monk is gone", () => {
    let s = withLinks(boxed, [[2, 0, 5, 0]]);
    s = { ...s, monks: [newMonk(5, 0)] };
    // Walks onto the entrance and stops there.
    while (p1(s).x < 2 * SUB) s = stepOne(s, press.right);
    s = run(s, press.none, 60);
    expect(p1(s)).toMatchObject({ x: 2 * SUB, y: 0, warp: 0 });
    // The monk dies (as in a filled hole): the next tick, the player jumps.
    s = { ...s, monks: [{ ...monk(s), mode: "dead", timer: MONK_TICKS.respawn }] };
    s = stepOne(s, press.none);
    expect(p1(s)).toMatchObject({ x: 5 * SUB, warp: TELEPORT_TICKS });
  });

  it("blocks even partly, in transit too; a dead monk does not block", () => {
    const s = withLinks(boxed, [[2, 0, 5, 0]]);
    const runner = { ...p1(s), x: 2 * SUB };
    const jump = (monks: Monk[]) => tryTeleport(s, runner, monks).warp > 0;
    expect(jump([])).toBe(true);
    expect(jump([newMonk(5, 0)])).toBe(false);
    expect(jump([{ ...newMonk(5, 0), x: 4 * SUB + 1 }])).toBe(false);
    expect(jump([{ ...newMonk(5, 0), x: 6 * SUB - 1 }])).toBe(false);
    expect(jump([{ ...newMonk(5, 0), x: 4 * SUB }])).toBe(true); // next to it
    expect(jump([{ ...newMonk(5, 0), mode: "dead" }])).toBe(true);
    // Regression (self-review): a monk waiting in transit on the exit let a second one
    // jump there, and both came out on top of each other.
    expect(jump([{ ...newMonk(5, 0), warp: 3 }])).toBe(false);
  });

  it("only an actor aligned on the entrance jumps", () => {
    const s = withLinks(corridor, corridorLink);
    const at = (x: number, y: number) => tryTeleport(s, { ...p1(s), x, y }, []).warp;
    expect(at(2 * SUB, 0)).toBe(TELEPORT_TICKS);
    expect(at(2 * SUB - 1, 0)).toBe(0);
    expect(at(2 * SUB + 1, 0)).toBe(0);
    expect(at(2 * SUB, 1)).toBe(0);
    // Already in transit: unchanged.
    expect(tryTeleport(s, { ...p1(s), x: 2 * SUB, warp: 5 }, []).warp).toBe(5);
  });
});

describe("monks and teleporters", () => {
  it("a monk walking onto an entrance teleports too", () => {
    // The monk chases the player rightwards over the entrance, which leads past it.
    let s = withLinks(["M.T..P..t", "@@@@@@@@@"], [[2, 0, 8, 0]]);
    let seen: Monk | null = null;
    for (let i = 0; i < 300 && seen === null; i++) {
      s = stepOne(s, press.none);
      if (inTransit(monk(s))) seen = monk(s);
    }
    expect(seen).toMatchObject({ x: 8 * SUB, y: 0, warp: TELEPORT_TICKS });
  });

  it("a monk in transit waits, and does not catch a player on its exit", () => {
    let s = withLinks(["T.t.P", "@@@@@"], [[0, 0, 2, 0]]);
    s = withPlayer(s, { x: 2 * SUB, y: 0 });
    s = { ...s, monks: [{ ...newMonk(2, 0), warp: 10 }] };
    const t = stepOne(s, press.none);
    expect(p1(t).mode).toBe("alive");
    expect(monk(t)).toMatchObject({ x: 2 * SUB, warp: 9 });
  });

  it("a player in transit is not caught, but monks chase it toward its exit", () => {
    let s = withLinks(["...tP", "@@@@@"], []);
    s = withPlayer(s, { x: 3 * SUB, y: 0, warp: 10 });
    // A monk on the player's cell: no catch.
    const touching = stepOne({ ...s, monks: [newMonk(3, 0)] }, press.none);
    expect(p1(touching).mode).toBe("alive");
    // Regression (self-review): monks froze for the whole transit of a lone player.
    const away = run({ ...s, monks: [newMonk(0, 0)] }, press.none, 9);
    expect(monk(away).x).toBeGreaterThan(0);
  });

  it("a walking monk does not step onto a monk in transit on its exit", () => {
    // Monk 0 waits in transit on the exit (3, 0); monk 1 walks right toward the player.
    let s = withLinks(["..Mt.P", "@@@@@@"], []);
    s = { ...s, monks: [{ ...newMonk(3, 0), warp: 40 }, newMonk(2, 0)] };
    s = run(s, press.none, 30);
    expect(monk(s, 1).x).toBe(2 * SUB);
  });

  // Randomized: random corridors with linked teleporters, monks and inputs. Every tick,
  // an actor in transit sits exactly on an exit cell, and its warp is in range; an actor
  // never jumps anywhere but to the exit linked to the entrance it stood on.
  it("an actor in transit always sits on an exit; warp stays within 0..TELEPORT_TICKS", () => {
    const rng = makeRng(2301);
    let jumps = 0;
    for (let trial = 0; trial < 40; trial++) {
      const w = 8 + randInt(rng, 8);
      const row = Array.from({ length: w }, () => ".");
      const put = (c: string): number => {
        for (;;) {
          const x = randInt(rng, w);
          if (row[x] === ".") {
            row[x] = c;
            return x;
          }
        }
      };
      const px = put("P");
      put("M");
      const entrances = [put("T"), put("T")];
      const exits = [put("t"), put("t")];
      const links: Teleport[] = entrances.map((x, i) => [x, 0, exits[i] ?? 0, 0]);
      const rows = [row.join(""), "@".repeat(w)];
      let s = withLinks(rows, links);
      const controls = [press.none, press.left, press.right];
      let input = press.none;
      for (let t = 0; t < 600 && s.status === "playing"; t++) {
        if (randInt(rng, 15) === 0) input = controls[randInt(rng, controls.length)] ?? press.none;
        const next = step(s, [input]);
        const why = `trial ${String(trial)} tick ${String(next.tick)}: ${rows[0] ?? ""} P@${String(px)}`;
        for (const a of [...next.players, ...next.monks]) {
          expect(a.warp, why).toBeGreaterThanOrEqual(0);
          expect(a.warp, why).toBeLessThanOrEqual(TELEPORT_TICKS);
          if (a.warp > 0) {
            expect(a.y, why).toBe(0);
            expect(exits, why).toContain(a.x / SUB);
          }
        }
        // A fresh jump comes from next to the entrance linked to that exit.
        const actors = (g: GameState) => [...g.players, ...g.monks];
        actors(next).forEach((a, i) => {
          const b = actors(s)[i];
          if (b === undefined || a.warp !== TELEPORT_TICKS) return;
          jumps += 1;
          const link = links.find(([, , ex]) => ex * SUB === a.x);
          expect(Math.abs(b.x - (link?.[0] ?? -99) * SUB), why).toBeLessThanOrEqual(1);
        });
        s = next;
      }
    }
    expect(jumps).toBeGreaterThan(20); // the test does exercise teleporters
  });
});
