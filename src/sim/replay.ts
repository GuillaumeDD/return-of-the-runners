import type { Level } from "../level/format";
import { parseLevel } from "../level/parse";
import { hashState } from "./hash";
import { NO_INPUT, type PlayerInput } from "./input";
import { TICKS_PER_SECOND } from "./rules";
import { createState, type GameState } from "./state";
import { step } from "./step";

/**
 * Replays: a level, a seed and the input of every tick. Since the simulation is pure
 * and deterministic, they rebuild the exact same game, byte for byte.
 *
 * The input log is run-length encoded: `[ticks, keys]` holds `keys` for `ticks` ticks
 * in a row. `keys` lists the pressed controls, in this order: L(eft), R(ight), U(p),
 * D(own), <(dig left), >(dig right); "" is no input.
 */

export const REPLAY_FORMAT_ID = "return-of-the-runners/replay";
export const REPLAY_FORMAT_VERSION = 1;

export const REPLAY_LIMITS = {
  /** Raw input size, in UTF-16 units (levels are capped at 64 KB on their own). */
  maxInputLength: 1024 * 1024,
  /** One hour of play. */
  maxTicks: 60 * 60 * TICKS_PER_SECOND,
  maxRuns: 100_000,
} as const;

export type InputRun = readonly [ticks: number, keys: string];

export interface Replay {
  readonly level: Level;
  readonly seed: number;
  readonly inputs: readonly InputRun[];
}

/** Controls in their canonical order, with their key letter. */
const KEYS: readonly (readonly [keyof PlayerInput, string])[] = [
  ["left", "L"],
  ["right", "R"],
  ["up", "U"],
  ["down", "D"],
  ["digLeft", "<"],
  ["digRight", ">"],
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

/** Runs a replay from the start of its level to the end of its input log. */
export function runReplay(replay: Replay): ReplayResult {
  let state = createState(replay.level, replay.seed);
  const checkpoints: number[] = [];
  for (const [ticks, keys] of replay.inputs) {
    const input = decodeKeys(keys);
    if (input === null) throw new Error(`runReplay: invalid keys "${keys}"`);
    for (let i = 0; i < ticks; i++) {
      state = step(state, input);
      if (state.tick % TICKS_PER_SECOND === 0) checkpoints.push(hashState(state));
    }
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

  if (!Array.isArray(inputs) || inputs.length > REPLAY_LIMITS.maxRuns) {
    return fail(`"inputs" must be an array of at most ${String(REPLAY_LIMITS.maxRuns)} runs`);
  }
  const runs: InputRun[] = [];
  let total = 0;
  for (const run of inputs as unknown[]) {
    if (!Array.isArray(run) || run.length !== 2) return fail("each run must be [ticks, keys]");
    const ticks: unknown = run[0];
    const keys: unknown = run[1];
    if (typeof ticks !== "number" || !Number.isInteger(ticks) || ticks < 1) {
      return fail("run ticks must be a positive integer");
    }
    if (typeof keys !== "string" || decodeKeys(keys) === null) {
      return fail(`run keys must be in canonical "LRUD<>" order`);
    }
    total += ticks;
    if (total > REPLAY_LIMITS.maxTicks) {
      return fail(`replay longer than ${String(REPLAY_LIMITS.maxTicks)} ticks`);
    }
    runs.push([ticks, keys]);
  }
  return { ok: true, replay: { level: parsed.level, seed, inputs: runs } };
}

function fail(error: string): ReplayParseResult {
  return { ok: false, error };
}
