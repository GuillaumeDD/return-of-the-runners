import { describe, expect, it } from "vitest";
import { NO_INPUT, type PlayerInput } from "../../src/sim/input";
import {
  type InputLog,
  REPLAY_FORMAT_ID,
  REPLAY_LIMITS,
  decodeInputs,
  decodeKeys,
  encodeInputs,
  encodeKeys,
  parseReplay,
  runReplay,
} from "../../src/sim/replay";
import { hashState } from "../../src/sim/hash";
import { TICKS_PER_SECOND } from "../../src/sim/rules";
import { createState } from "../../src/sim/state";
import { playersAtExit } from "../../src/sim/step";
import { makeRng, randInt } from "../helpers/rng";
import { replayFixtures } from "../helpers/replays";

const fixtures = replayFixtures();

describe("committed replays (Node)", () => {
  it("there are replays to check", () => {
    expect(fixtures.map((f) => f.name)).toEqual([
      "bombs",
      "coop-monks",
      "default-level",
      "first-steps-random",
      "goo",
      "keys",
      "monk-trap-respawn",
      "snare-gas",
      "teleport",
      "terrain",
      "tools",
      "versus-race",
      "win-gold-and-exit",
    ]);
    // At least one replay has two players.
    expect(fixtures.some((f) => f.replay.inputs.length === 2)).toBe(true);
  });

  it("terrain: the monk reappears at the respawn point; the hidden ladder is out at the end", () => {
    const f = fixtures.find((x) => x.name === "terrain");
    if (f === undefined) throw new Error("missing terrain");
    const respawned = runReplay({
      ...f.replay,
      inputs: f.replay.inputs.map((log) => encodeInputs(decodeInputs(log).slice(0, 633))),
    }).state;
    expect(respawned.monks.map((m) => [m.mode, m.x, m.y])).toEqual([["free", 0, 0]]);
    const end = runReplay(f.replay).state;
    expect(end.tiles.map((r) => r.charAt(12)).slice(1, 7)).toEqual(Array(6).fill("H"));
    expect(end.status).toBe("won");
  });

  it("keys: the green door opens on the second try, the red one at the end", () => {
    const f = fixtures.find((x) => x.name === "keys");
    if (f === undefined) throw new Error("missing keys");
    const at = (ticks: number) =>
      runReplay({
        ...f.replay,
        inputs: f.replay.inputs.map((log) => encodeInputs(decodeInputs(log).slice(0, ticks))),
      }).state;
    // Holding the red key, stopped at the green door.
    const stopped = at(130);
    expect([stopped.players[0]?.item, stopped.tiles[5]]).toEqual(["a", "....b.B.$.A.E."]);
    const end = runReplay(f.replay).state;
    expect([end.status, end.players[0]?.item, end.tiles[5]]).toEqual(["won", "", "............E."]);
  });

  it("bombs: the wall is blown away, the chain goes off, the big bomb opens the floor", () => {
    const f = fixtures.find((x) => x.name === "bombs");
    if (f === undefined) throw new Error("missing bombs");
    const at = (ticks: number) =>
      runReplay({
        ...f.replay,
        inputs: f.replay.inputs.map((log) => encodeInputs(decodeInputs(log).slice(0, ticks))),
      }).state;
    // Both bombs picked up, the small one laid first.
    expect(at(96).players[0]?.bombs).toBe("oO");
    expect(at(97).fuses).toEqual([{ cx: 6, cy: 3, big: false, left: 150 }]);
    // The wall is a crater, and the bomb lying behind it burns.
    const chain = at(300);
    expect(chain.craters.map((c) => [c.cx, c.cy])).toEqual([[7, 3]]);
    expect(chain.fuses.map((x) => [x.cx, x.big])).toEqual([[8, false]]);
    expect(chain.tiles[3]).toBe(".......#........");
    const end = runReplay(f.replay).state;
    expect(end.status).toBe("won");
    expect(end.tiles[4]).toBe("@@@@@@@@@@.....@");
  });

  it("snare-gas: both monks dazed in the first cloud; one snared, one dazed at the end", () => {
    const f = fixtures.find((x) => x.name === "snare-gas");
    if (f === undefined) throw new Error("missing snare-gas");
    const at = (ticks: number) =>
      runReplay({
        ...f.replay,
        inputs: f.replay.inputs.map((log) => encodeInputs(decodeInputs(log).slice(0, ticks))),
      }).state;
    expect(at(200).monks.map((m) => m.mode)).toEqual(["dazed", "dazed"]);
    expect(at(700).monks.map((m) => m.mode)).toEqual(["free", "free"]);
    const end = runReplay(f.replay).state;
    expect([end.status, end.snares, end.players[0]?.item]).toEqual(["won", [], "g"]);
    expect(end.monks.map((m) => m.mode)).toEqual(["snared", "dazed"]);
  });

  it("goo: the goo lies under the three cells left of the ladder; without it the monk wins", () => {
    const f = fixtures.find((x) => x.name === "goo");
    if (f === undefined) throw new Error("missing goo");
    const end = runReplay(f.replay).state;
    expect([end.status, end.players[0]?.item]).toEqual(["won", ""]);
    expect(end.tiles[7]?.slice(10, 15)).toBe("@~~~@");
    // The same inputs with no bucket to pick up: the monk catches the runner.
    const grid = f.replay.level.grid.map((r) => r.replace("u", "."));
    const plain = runReplay({ ...f.replay, level: { ...f.replay.level, grid } }).state;
    expect(plain.status).not.toBe("won");
    expect(plain.players[0]?.mode).toBe("dead");
  });

  it("tools: the rubble walls the monk out while the runner drills down and wins", () => {
    const f = fixtures.find((x) => x.name === "tools");
    if (f === undefined) throw new Error("missing tools");
    const at = (ticks: number) =>
      runReplay({
        ...f.replay,
        inputs: f.replay.inputs.map((log) => encodeInputs(decodeInputs(log).slice(0, ticks))),
      }).state;
    // Drilling with the jackhammer, the pickaxe left where it stood; the monk stopped
    // right of the rubble.
    const drilling = at(200);
    expect(drilling.players[0]).toMatchObject({ item: "j", drill: true });
    expect(drilling.tiles[3]?.charAt(4)).toBe("k");
    expect(drilling.rubble.map((r) => [r.cx, r.y / 8])).toEqual([[5, 3]]);
    expect(drilling.monks.map((m) => [m.x / 8, m.y / 8])).toEqual([[6, 3]]);
    const end = runReplay(f.replay).state;
    expect(end.status).toBe("won");
    expect(end.holes.map((h) => [h.cx, h.cy])).toEqual([
      [4, 4],
      [4, 5],
    ]);
  });

  it("teleport: the monk, then the runner, go through a teleporter", () => {
    const f = fixtures.find((x) => x.name === "teleport");
    if (f === undefined) throw new Error("missing teleport");
    const at = (ticks: number) =>
      runReplay({
        ...f.replay,
        inputs: f.replay.inputs.map((log) => encodeInputs(decodeInputs(log).slice(0, ticks))),
      }).state;
    const monkIn = at(30);
    expect(monkIn.monks.map((m) => [m.x, m.y, m.warp > 0])).toEqual([[11 * 8, 5 * 8, true]]);
    const runnerIn = at(60);
    expect(runnerIn.players.map((p) => [p.x, p.y, p.warp > 0])).toEqual([[0, 0, true]]);
    expect(runReplay(f.replay).state.status).toBe("won");
  });

  it("versus-race is won by player 1 alone, player 2 having its own gold", () => {
    const f = fixtures.find((x) => x.name === "versus-race");
    if (f === undefined) throw new Error("missing versus-race");
    const { state } = runReplay(f.replay);
    expect(playersAtExit(state)).toEqual([0]);
    expect(state.players.map((p) => p.gold)).toEqual([1, 1]);
  });

  // If one of these changes, gameplay changed: update the fixture only together with
  // an intentional rules change, and say so in the PR.
  for (const f of fixtures) {
    it(`${f.name} reaches its committed tick, status and hash`, () => {
      const { state, checkpoints } = runReplay(f.replay);
      expect({ tick: state.tick, status: state.status, hash: checkpoints.at(-1) }).toEqual(
        f.expected,
      );
    });
  }

  // A replay of a finished game stops on the tick it ended: later ticks only count, so
  // they would add nothing to the evidence.
  it("each replay ends on the tick the game ends (no padding after it)", () => {
    for (const f of fixtures) {
      if (f.expected.status === "playing") continue;
      const shorter = f.replay.inputs.map(dropLastTick);
      expect(runReplay({ ...f.replay, inputs: shorter }).state.status, f.name).toBe("playing");
    }
  });

  it("replaying twice in the same process gives the same hash at every checkpoint", () => {
    for (const f of fixtures) {
      const a = runReplay(f.replay).checkpoints;
      const b = runReplay(f.replay).checkpoints;
      expect(a.length).toBe(Math.ceil(f.expected.tick / TICKS_PER_SECOND));
      expect(b).toEqual(a);
    }
  });
});

/** The log without its last tick. */
function dropLastTick(log: InputLog): InputLog {
  const last = log.at(-1);
  if (last === undefined) return log;
  return [...log.slice(0, -1), ...(last[0] > 1 ? [[last[0] - 1, last[1]] as const] : [])];
}

const ALL_INPUTS: PlayerInput[] = Array.from({ length: 512 }, (_, bits) => ({
  left: (bits & 1) !== 0,
  right: (bits & 2) !== 0,
  up: (bits & 4) !== 0,
  down: (bits & 8) !== 0,
  digLeft: (bits & 16) !== 0,
  digRight: (bits & 32) !== 0,
  pickUp: (bits & 64) !== 0,
  use: (bits & 128) !== 0,
  bomb: (bits & 256) !== 0,
}));

describe("runReplay", () => {
  // Regression (self-review): an empty log returned no checkpoint at all.
  it("an empty input log gives one checkpoint: the hash of the initial state", () => {
    const f = fixtures[0];
    if (f === undefined) throw new Error("no fixture");
    const { state, checkpoints } = runReplay({ ...f.replay, inputs: [[]] });
    expect(state.tick).toBe(0);
    expect(checkpoints).toEqual([hashState(createState(f.replay.level, f.replay.seed))]);
  });

  it("hashes every 60th tick, plus the last tick when it is not one", () => {
    const f = fixtures[0];
    if (f === undefined) throw new Error("no fixture");
    expect(runReplay({ ...f.replay, inputs: [[[120, ""]]] }).checkpoints).toHaveLength(2);
    expect(runReplay({ ...f.replay, inputs: [[[121, ""]]] }).checkpoints).toHaveLength(3);
  });

  it("feeds each log to its own player", () => {
    const level = {
      version: 2 as const,
      name: "t",
      width: 8,
      height: 2,
      grid: ["P..$..Q.", "########"],
      teleports: [],
    };
    const { state } = runReplay({ level, seed: 1, inputs: [[[16, "R"]], [[16, "L"]]] });
    expect(state.players.map((p) => p.x)).toEqual([8, 5 * 8]);
  });

  it("refuses zero or three logs", () => {
    const f = fixtures[0];
    if (f === undefined) throw new Error("no fixture");
    expect(() => runReplay({ ...f.replay, inputs: [] })).toThrow();
    expect(() => runReplay({ ...f.replay, inputs: [[], [], []] })).toThrow();
  });
});

describe("input log encoding", () => {
  it("encodes keys in canonical order, and decodes them back, for all 512 inputs", () => {
    expect(encodeKeys(NO_INPUT)).toBe("");
    expect(encodeKeys(ALL_INPUTS[511] ?? NO_INPUT)).toBe("LRUD<>IXB");
    for (const input of ALL_INPUTS) expect(decodeKeys(encodeKeys(input))).toEqual(input);
  });

  it("rejects unknown, repeated or out-of-order keys", () => {
    for (const bad of ["x", "LL", "RL", "><", "L ", "l", "UD<>R", "XI", "BX"]) {
      expect(decodeKeys(bad), bad).toBeNull();
    }
  });

  it("run-length encodes: equal neighbours merge, the round trip is exact", () => {
    const l = { ...NO_INPUT, left: true };
    expect(encodeInputs([l, l, NO_INPUT, l])).toEqual([
      [2, "L"],
      [1, ""],
      [1, "L"],
    ]);
    const rng = makeRng(10);
    for (let i = 0; i < 200; i++) {
      const inputs = Array.from(
        { length: randInt(rng, 300) },
        () => ALL_INPUTS[randInt(rng, 4) === 0 ? randInt(rng, 512) : 0] ?? NO_INPUT,
      );
      expect(decodeInputs(encodeInputs(inputs))).toEqual(inputs);
    }
  });
});

describe("parseReplay", () => {
  const base = JSON.parse(
    JSON.stringify({
      format: REPLAY_FORMAT_ID,
      version: 2,
      seed: 1,
      level: {
        format: "return-of-the-runners/level",
        version: 2,
        name: "t",
        width: 8,
        height: 8,
        grid: [
          "........",
          "........",
          "........",
          "........",
          "........",
          "........",
          "P..$..EQ",
          "########",
        ],
      },
      inputs: [
        [
          [10, "R"],
          [1, ">"],
        ],
      ],
    }),
  ) as Record<string, unknown>;
  const text = (patch: Record<string, unknown>): string => JSON.stringify({ ...base, ...patch });

  it("accepts a valid replay, with one or two logs", () => {
    const ok = parseReplay(text({}));
    expect(ok.ok && ok.replay.inputs).toEqual([
      [
        [10, "R"],
        [1, ">"],
      ],
    ]);
    const two = parseReplay(
      text({
        inputs: [
          [[11, "R"]],
          [
            [5, "L"],
            [6, ""],
          ],
        ],
      }),
    );
    expect(two.ok && two.replay.inputs).toHaveLength(2);
  });

  it("rejects malformed documents, each with a reason", () => {
    const cases: [string, string][] = [
      ["not json", "{"],
      ["array", "[]"],
      ["wrong format", text({ format: "other" })],
      ["unknown version", text({ version: 3 })],
      ["version 1 (a single log)", text({ version: 1, inputs: [[10, "R"]] })],
      ["version as string", text({ version: "2" })],
      ["unknown field", text({ extra: true })],
      ["negative seed", text({ seed: -1 })],
      ["seed too big", text({ seed: 2 ** 32 })],
      ["fractional seed", text({ seed: 1.5 })],
      ["invalid level", text({ level: { ...(base.level as object), grid: [] } })],
      ["no level", text({ level: undefined })],
      ["inputs not array", text({ inputs: "R" })],
      ["no log", text({ inputs: [] })],
      ["three logs", text({ inputs: [[[1, ""]], [[1, ""]], [[1, ""]]] })],
      ["log not array", text({ inputs: ["R"] })],
      ["v1-style log", text({ inputs: [[1, "R"]] })],
      ["run not a pair", text({ inputs: [[[1]]] })],
      ["zero ticks", text({ inputs: [[[0, ""]]] })],
      ["fractional ticks", text({ inputs: [[[1.5, ""]]] })],
      ["bad keys", text({ inputs: [[[1, "RL"]]] })],
      ["too long", text({ inputs: [[[REPLAY_LIMITS.maxTicks + 1, ""]]] })],
      [
        "too long in total",
        text({
          inputs: [
            [
              [REPLAY_LIMITS.maxTicks, ""],
              [1, ""],
            ],
          ],
        }),
      ],
      [
        "too many runs",
        text({ inputs: [Array.from({ length: REPLAY_LIMITS.maxRuns + 1 }, () => [1, ""])] }),
      ],
      [
        "too many runs over two logs",
        text({
          inputs: [
            Array.from({ length: REPLAY_LIMITS.maxRuns / 2 + 1 }, () => [1, ""]),
            Array.from({ length: REPLAY_LIMITS.maxRuns / 2 }, () => [1, ""]).concat([[1, ""]]),
          ],
        }),
      ],
      ["logs of different lengths", text({ inputs: [[[11, "R"]], [[10, "L"]]] })],
      [
        "two logs on a level without a player 2 start",
        text({
          level: {
            ...(base.level as object),
            grid: [
              "........",
              "........",
              "........",
              "........",
              "........",
              "........",
              "P..$..E.",
              "########",
            ],
          },
          inputs: [[[1, ""]], [[1, ""]]],
        }),
      ],
      ["too large", " ".repeat(REPLAY_LIMITS.maxInputLength + 1)],
    ];
    for (const [what, input] of cases) {
      const r = parseReplay(input);
      expect(r.ok, what).toBe(false);
      if (!r.ok) expect(r.error.length, what).toBeGreaterThan(0);
    }
  });

  it("never throws on random mutations of a valid replay", () => {
    const valid = text({});
    const rng = makeRng(11);
    const chars = '{}[]",:0123456789-.LRUD<>IXBaZ ';
    for (let i = 0; i < 2000; i++) {
      let s = valid;
      for (let k = 0; k <= randInt(rng, 4); k++) {
        const at = randInt(rng, s.length);
        const op = randInt(rng, 3);
        const c = chars.charAt(randInt(rng, chars.length));
        s =
          op === 0
            ? s.slice(0, at) + c + s.slice(at + 1)
            : op === 1
              ? s.slice(0, at) + s.slice(at + 1)
              : s.slice(0, at) + c + s.slice(at);
      }
      const r = parseReplay(s);
      // Whatever is accepted can be run.
      if (r.ok) expect(() => r.replay.inputs.map(decodeInputs)).not.toThrow();
    }
  });
});
