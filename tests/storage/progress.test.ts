import { describe, expect, it } from "vitest";
import type { StorageLike } from "../../src/storage/levels";
import {
  NO_PROGRESS,
  PROGRESS_FORMAT_ID,
  PROGRESS_KEY,
  markDone,
  readProgress,
  saveProgress,
} from "../../src/storage/progress";
import { makeRng, randInt } from "../helpers/rng";

const KNOWN = ["one", "two", "three"];

function memory(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const refusing: StorageLike = {
  getItem: () => {
    throw new DOMException("blocked", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("full", "QuotaExceededError");
  },
};

function stored(doc: unknown): StorageLike {
  return memory({ [PROGRESS_KEY]: JSON.stringify(doc) });
}

describe("pack progress", () => {
  it("reads back what was saved", () => {
    const store = memory();
    expect(saveProgress(store, { current: "two", done: ["one", "three"] })).toBe(true);
    expect(readProgress(store, KNOWN)).toEqual({ current: "two", done: ["one", "three"] });
  });

  it("nothing stored, or storage blocked: no progress, and a refused save says so", () => {
    expect(readProgress(memory(), KNOWN)).toEqual(NO_PROGRESS);
    expect(readProgress(refusing, KNOWN)).toEqual(NO_PROGRESS);
    expect(saveProgress(refusing, NO_PROGRESS)).toBe(false);
  });

  it("a broken document reads as no progress: not JSON, wrong format or version, too long", () => {
    const base = { format: PROGRESS_FORMAT_ID, version: 1, current: "one", done: ["one"] };
    expect(readProgress(memory({ [PROGRESS_KEY]: "{" }), KNOWN)).toEqual(NO_PROGRESS);
    expect(readProgress(stored(null), KNOWN)).toEqual(NO_PROGRESS);
    expect(readProgress(stored({ ...base, format: "other" }), KNOWN)).toEqual(NO_PROGRESS);
    expect(readProgress(stored({ ...base, version: 2 }), KNOWN)).toEqual(NO_PROGRESS);
    const long = { ...base, done: Array.from({ length: 5000 }, () => "one") };
    expect(readProgress(stored(long), KNOWN)).toEqual(NO_PROGRESS);
  });

  it("keeps only known levels, once each, in pack order", () => {
    const doc = {
      format: PROGRESS_FORMAT_ID,
      version: 1,
      current: "gone",
      done: ["three", 7, "gone", "one", "three", null],
    };
    expect(readProgress(stored(doc), KNOWN)).toEqual({ current: null, done: ["one", "three"] });
  });

  it("a done list that is not an array reads as none done, the current level kept", () => {
    const doc = { format: PROGRESS_FORMAT_ID, version: 1, current: "two", done: "one" };
    expect(readProgress(stored(doc), KNOWN)).toEqual({ current: "two", done: [] });
  });

  it("markDone adds a level once, in pack order, and keeps the current level", () => {
    let p = markDone({ current: "three", done: [] }, "three", KNOWN);
    p = markDone(p, "one", KNOWN);
    p = markDone(p, "three", KNOWN);
    expect(p).toEqual({ current: "three", done: ["one", "three"] });
  });

  it("never throws on random stored text, and returns only known ids (randomized)", () => {
    const rng = makeRng(51);
    const pieces = ['"one"', '"two"', '"x"', "1", "null", "[", "]", "{", "}", ",", ":", '"done"'];
    for (let i = 0; i < 500; i++) {
      let text = '{"format":"return-of-the-runners/progress","version":1,';
      const n = randInt(rng, 13);
      for (let j = 0; j < n; j++) text += pieces[randInt(rng, pieces.length)] ?? "";
      const p = readProgress(memory({ [PROGRESS_KEY]: text }), KNOWN);
      expect(p.current === null || KNOWN.includes(p.current)).toBe(true);
      expect(p.done.every((id) => KNOWN.includes(id))).toBe(true);
    }
  });
});
