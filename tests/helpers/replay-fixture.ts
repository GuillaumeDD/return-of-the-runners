import { parseReplay, type Replay } from "../../src/sim/replay";
import type { Status } from "../../src/sim/state";

/** A committed replay and the result it must reach. */
export interface ReplayFixture {
  readonly name: string;
  readonly replay: Replay;
  readonly expected: { readonly tick: number; readonly status: Status; readonly hash: number };
}

const STATUSES: readonly string[] = ["playing", "dead", "won"] satisfies Status[];

function isExpected(v: unknown): v is ReplayFixture["expected"] {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    Object.keys(o).length === 3 &&
    Number.isInteger(o.tick) &&
    typeof o.status === "string" &&
    STATUSES.includes(o.status) &&
    Number.isInteger(o.hash)
  );
}

/** Parses one fixture file: `{ about, replay, expected }`, both strictly validated. */
export function parseFixture(name: string, text: string): ReplayFixture {
  const doc = JSON.parse(text) as Record<string, unknown>;
  const parsed = parseReplay(JSON.stringify(doc.replay ?? null));
  if (!parsed.ok) throw new Error(`replay fixture ${name}: ${parsed.error}`);
  if (!isExpected(doc.expected)) {
    throw new Error(`replay fixture ${name}: "expected" must be { tick, status, hash }`);
  }
  return { name, replay: parsed.replay, expected: doc.expected };
}

/** Fixtures from `[path, text]` pairs (from the file system or a Vite glob), by file name. */
export function fixturesFrom(files: Iterable<readonly [string, string]>): ReplayFixture[] {
  return [...files]
    .map(([path, text]) => parseFixture(path.replace(/^.*\//, "").replace(/\.json$/, ""), text))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
