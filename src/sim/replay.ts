import type { Level } from "../level/format";
import { parseLevel } from "../level/parse";
import { hashState } from "./hash";
import { NO_INPUT, type PlayerInput } from "./input";
import { TICKS_PER_SECOND } from "./rules";
import { createState, maxPlayers, type GameState } from "./state";
import { step } from "./step";

/**
 * Replays: a level, a seed and every player's input for every tick. Since the
 * simulation is pure and deterministic, they rebuild the exact same game, byte for byte.
 *
 * `inputs` holds one log per player (one or two logs: the player count), all covering
 * the same number of ticks. A log is run-length encoded: `[ticks, keys]` holds `keys`
 * for `ticks` ticks in a row. `keys` lists the pressed controls, in this order: L(eft),
 * R(ight), U(p), D(own), <(dig left), >(dig right); "" is no input.
 *
 * Version 1 (a single log, before two players existed) is no longer read: replays are
 * test fixtures only, and those were rewritten as version 2.
 */

export const REPLAY_FORMAT_ID = "return-of-the-runners/replay";
export const REPLAY_FORMAT_VERSION = 2;

export const REPLAY_LIMITS = {
  /** Raw input size, in UTF-16 units (levels are capped at 64 KB on their own). */
  maxInputLength: 1024 * 1024,
  /** One hour of play. */
  maxTicks: 60 * 60 * TICKS_PER_SECOND,
  maxRuns: 100_000,
} as const;

export type InputRun = readonly [ticks: number, keys: string];

/** One player's run-length encoded input log. */
export type InputLog = readonly InputRun[];

export interface Replay {
  readonly level: Level;
  readonly seed: number;
  /** One log per player, player 1 first. */
  readonly inputs: readonly InputLog[];
}

/** Controls in their canonical order, with their key letter. */
const KEYS: readonly (readonly [keyof PlayerInput, string])[] = [
  ["left", "L"],
  ["right", "R"],
  ["up", "U"],
  ["down", "D"],
  ["digLeft", "<"],
  ["digRight", ">"],
  ["pickUp", "I"],
  ["use", "X"],
  ["bomb", "B"],
];

export function encodeKeys(input: PlayerInput): string {
  return KEYS.filter(([control]) => input[control])
    .map(([, key]) => key)
    .join("");
}

/** Decodes canonical keys; returns null for anything else (unknown, repeated, unordered). */
export function decodeKeys(keys: string): PlayerInput | null {
  let input: PlayerInput = NO_INPUT;
  let i = 0;
  for (const [control, key] of KEYS) {
    if (keys.charAt(i) === key) {
      input = { ...input, [control]: true };
      i++;
    }
  }
  return i === keys.length ? input : null;
}

/** Run-length encodes one input per tick. */
export function encodeInputs(inputs: readonly PlayerInput[]): InputRun[] {
  const runs: [number, string][] = [];
  for (const input of inputs) {
    const keys = encodeKeys(input);
    const last = runs[runs.length - 1];
    if (last !== undefined && last[1] === keys) last[0]++;
    else runs.push([1, keys]);
  }
  return runs;
}

/** One input per tick. The runs must be valid (as `parseReplay` checks). */
export function decodeInputs(runs: readonly InputRun[]): PlayerInput[] {
  const out: PlayerInput[] = [];
  for (const [ticks, keys] of runs) {
    const input = decodeKeys(keys);
    if (input === null) throw new Error(`decodeInputs: invalid keys "${keys}"`);
    for (let i = 0; i < ticks; i++) out.push(input);
  }
  return out;
}

export interface ReplayResult {
  readonly state: GameState;
  /** The state hash after every `TICKS_PER_SECOND` ticks, then after the last tick. */
  readonly checkpoints: readonly number[];
}

/** Runs a replay from the start of its level to the end of its input logs. */
export function runReplay(replay: Replay): ReplayResult {
  const count = replay.inputs.length;
  if (count !== 1 && count !== 2) throw new Error("runReplay: one or two input logs");
  const logs = replay.inputs.map(decodeInputs);
  const ticks = Math.max(...logs.map((log) => log.length));
  let state = createState(replay.level, replay.seed, count);
  const checkpoints: number[] = [];
  for (let i = 0; i < ticks; i++) {
    state = step(
      state,
      logs.map((log) => log[i] ?? NO_INPUT),
    );
    if (state.tick % TICKS_PER_SECOND === 0) checkpoints.push(hashState(state));
  }
  // The final state, unless the last tick was a checkpoint (always, for an empty log).
  if (checkpoints.length === 0 || state.tick % TICKS_PER_SECOND !== 0) {
    checkpoints.push(hashState(state));
  }
  return { state, checkpoints };
}

export type ReplayParseResult =
  { readonly ok: true; readonly replay: Replay } | { readonly ok: false; readonly error: string };

const FIELDS: ReadonlySet<string> = new Set(["format", "version", "seed", "level", "inputs"]);

/**
 * Parses and validates an untrusted replay document; the embedded level goes through
 * the level validator. Never throws. Fields other than the replay's own (such as a
 * fixture's expected results) are rejected, so callers strip them first.
 */
export function parseReplay(text: string): ReplayParseResult {
  if (text.length > REPLAY_LIMITS.maxInputLength) return fail("input too large");
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return fail("not JSON");
  }
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    return fail("top level must be an object");
  }
  const obj = doc as Record<string, unknown>;
  if (obj.format !== REPLAY_FORMAT_ID) return fail(`"format" must be "${REPLAY_FORMAT_ID}"`);
  if (obj.version !== REPLAY_FORMAT_VERSION) {
    return fail(`"version" must be ${String(REPLAY_FORMAT_VERSION)}`);
  }
  for (const key of Object.keys(obj)) {
    if (!FIELDS.has(key)) return fail(`unknown field "${key.slice(0, 32)}"`);
  }

  const { seed, level, inputs } = obj;
  if (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    return fail(`"seed" must be an integer from 0 to 2^32 - 1`);
  }

  const parsed = parseLevel(JSON.stringify(level ?? null));
  if (!parsed.ok) {
    return fail(`invalid level: ${parsed.errors.map((e) => e.code).join(", ")}`);
  }

  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 2) {
    return fail(`"inputs" must hold one input log per player (one or two)`);
  }
  if (inputs.length === 2 && maxPlayers(parsed.level) !== 2) {
    return fail("two input logs need a level with a player 2 start");
  }
  const logs: InputRun[][] = [];
  let runCount = 0;
  for (const log of inputs as unknown[]) {
    const runs = parseLog(log, REPLAY_LIMITS.maxRuns - runCount);
    if (typeof runs === "string") return fail(runs);
    runCount += runs.runs.length;
    if (logs.length > 0 && runs.ticks !== ticksOf(logs[0] ?? [])) {
      return fail("every input log must cover the same number of ticks");
    }
    logs.push(runs.runs);
  }
  return { ok: true, replay: { level: parsed.level, seed, inputs: logs } };
}

function ticksOf(log: InputLog): number {
  return log.reduce((sum, [ticks]) => sum + ticks, 0);
}

/** One input log, or why it is invalid. `maxRuns`: runs left for this log. */
function parseLog(log: unknown, maxRuns: number): { runs: InputRun[]; ticks: number } | string {
  if (!Array.isArray(log) || log.length > maxRuns) {
    return `an input log must be an array; at most ${String(REPLAY_LIMITS.maxRuns)} runs in all`;
  }
  const runs: InputRun[] = [];
  let total = 0;
  for (const run of log as unknown[]) {
    if (!Array.isArray(run) || run.length !== 2) return "each run must be [ticks, keys]";
    const ticks: unknown = run[0];
    const keys: unknown = run[1];
    if (typeof ticks !== "number" || !Number.isInteger(ticks) || ticks < 1) {
      return "run ticks must be a positive integer";
    }
    if (typeof keys !== "string" || decodeKeys(keys) === null) {
      return `run keys must be in canonical "LRUD<>IXB" order`;
    }
    total += ticks;
    if (total > REPLAY_LIMITS.maxTicks) {
      return `replay longer than ${String(REPLAY_LIMITS.maxTicks)} ticks`;
    }
    runs.push([ticks, keys]);
  }
  return { runs, ticks: total };
}

function fail(error: string): ReplayParseResult {
  return { ok: false, error };
}
