import { describe, expect, it } from "vitest";
import { NO_INPUT, type PlayerInput } from "../../src/sim/input";
import {
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
import { makeRng, randInt } from "../helpers/rng";
import { replayFixtures } from "../helpers/replays";

const fixtures = replayFixtures();

describe("committed replays (Node)", () => {
  it("there are replays to check", () => {
    expect(fixtures.map((f) => f.name)).toEqual([
      "first-steps-random",
      "monk-trap-respawn",
      "win-gold-and-exit",
    ]);
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
      const last = f.replay.inputs.at(-1);
      if (last === undefined) throw new Error(f.name);
      const shorter = [
        ...f.replay.inputs.slice(0, -1),
        ...(last[0] > 1 ? [[last[0] - 1, last[1]] as const] : []),
      ];
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

const ALL_INPUTS: PlayerInput[] = Array.from({ length: 64 }, (_, bits) => ({
  left: (bits & 1) !== 0,
  right: (bits & 2) !== 0,
  up: (bits & 4) !== 0,
  down: (bits & 8) !== 0,
  digLeft: (bits & 16) !== 0,
  digRight: (bits & 32) !== 0,
}));

describe("runReplay", () => {
  // Regression (self-review): an empty log returned no checkpoint at all.
  it("an empty input log gives one checkpoint: the hash of the initial state", () => {
    const f = fixtures[0];
    if (f === undefined) throw new Error("no fixture");
    const { state, checkpoints } = runReplay({ ...f.replay, inputs: [] });
    expect(state.tick).toBe(0);
    expect(checkpoints).toEqual([hashState(createState(f.replay.level, f.replay.seed))]);
  });

  it("hashes every 60th tick, plus the last tick when it is not one", () => {
    const f = fixtures[0];
    if (f === undefined) throw new Error("no fixture");
    expect(runReplay({ ...f.replay, inputs: [[120, ""]] }).checkpoints).toHaveLength(2);
    expect(runReplay({ ...f.replay, inputs: [[121, ""]] }).checkpoints).toHaveLength(3);
  });
});

describe("input log encoding", () => {
  it("encodes keys in canonical order, and decodes them back, for all 64 inputs", () => {
    expect(encodeKeys(NO_INPUT)).toBe("");
    expect(encodeKeys(ALL_INPUTS[63] ?? NO_INPUT)).toBe("LRUD<>");
    for (const input of ALL_INPUTS) expect(decodeKeys(encodeKeys(input))).toEqual(input);
  });

  it("rejects unknown, repeated or out-of-order keys", () => {
    for (const bad of ["x", "LL", "RL", "><", "L ", "l", "UD<>R"]) {
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
        () => ALL_INPUTS[randInt(rng, 4) === 0 ? randInt(rng, 64) : 0] ?? NO_INPUT,
      );
      expect(decodeInputs(encodeInputs(inputs))).toEqual(inputs);
    }
  });
});

describe("parseReplay", () => {
  const base = JSON.parse(
    JSON.stringify({
      format: REPLAY_FORMAT_ID,
      version: 1,
      seed: 1,
      level: {
        format: "return-of-the-runners/level",
        version: 1,
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
          "P..$..E.",
          "########",
        ],
      },
      inputs: [
        [10, "R"],
        [1, ">"],
      ],
    }),
  ) as Record<string, unknown>;
  const text = (patch: Record<string, unknown>): string => JSON.stringify({ ...base, ...patch });

  it("accepts a valid replay", () => {
    const ok = parseReplay(text({}));
    expect(ok.ok && ok.replay.inputs).toEqual([
      [10, "R"],
      [1, ">"],
    ]);
  });

  it("rejects malformed documents, each with a reason", () => {
    const cases: [string, string][] = [
      ["not json", "{"],
      ["array", "[]"],
      ["wrong format", text({ format: "other" })],
      ["unknown version", text({ version: 2 })],
      ["version as string", text({ version: "1" })],
      ["unknown field", text({ extra: true })],
      ["negative seed", text({ seed: -1 })],
      ["seed too big", text({ seed: 2 ** 32 })],
      ["fractional seed", text({ seed: 1.5 })],
      ["invalid level", text({ level: { ...(base.level as object), grid: [] } })],
      ["no level", text({ level: undefined })],
      ["inputs not array", text({ inputs: "R" })],
      ["run not a pair", text({ inputs: [[1]] })],
      ["zero ticks", text({ inputs: [[0, ""]] })],
      ["fractional ticks", text({ inputs: [[1.5, ""]] })],
      ["bad keys", text({ inputs: [[1, "RL"]] })],
      ["too long", text({ inputs: [[REPLAY_LIMITS.maxTicks + 1, ""]] })],
      [
        "too long in total",
        text({
          inputs: [
            [REPLAY_LIMITS.maxTicks, ""],
            [1, ""],
          ],
        }),
      ],
      [
        "too many runs",
        text({ inputs: Array.from({ length: REPLAY_LIMITS.maxRuns + 1 }, () => [1, ""]) }),
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
    const chars = '{}[]",:0123456789-.LRUD<>aZ ';
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
      if (r.ok) expect(() => decodeInputs(r.replay.inputs)).not.toThrow();
    }
  });
});
