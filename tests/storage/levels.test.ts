import { describe, expect, it } from "vitest";
import type { Level } from "../../src/level/format";
import { parseLevel } from "../../src/level/parse";
import { draftOf, levelDocument } from "../../src/level/serialize";
import {
  BACKUP_KEY,
  STORAGE_KEY,
  STORE_FORMAT_ID,
  deleteLevel,
  getLevel,
  listLevels,
  saveLevel,
  type StorageLike,
} from "../../src/storage/levels";
import { makeRng, randInt } from "../helpers/rng";

/** An in-memory `Storage`; `full` makes every write throw like a full quota. */
function memory(initial: Record<string, string> = {}): StorageLike & {
  data: Map<string, string>;
  full: boolean;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    full: false,
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      if (this.full) throw new DOMException("full", "QuotaExceededError");
      data.set(key, value);
    },
  };
}

function level(name: string, gold = 1): Level {
  const grid = [
    ".".repeat(8),
    ".".repeat(8),
    ".".repeat(8),
    ".".repeat(8),
    ".".repeat(8),
    ".".repeat(8),
    "P" + "$".repeat(gold) + ".".repeat(6 - gold) + "E",
    "@".repeat(8),
  ];
  const r = parseLevel(JSON.stringify(levelDocument({ name, width: 8, height: 8, grid })));
  if (!r.ok) throw new Error(r.errors.map((e) => e.code).join());
  return r.level;
}

const names = (s: StorageLike): string[] => listLevels(s).levels.map((l) => l.level.name);

describe("save and list", () => {
  it("an empty storage lists no levels and no problems", () => {
    expect(listLevels(memory())).toEqual({ levels: [], problems: [] });
  });

  it("save then list returns the level, last saved first", () => {
    const s = memory();
    const a = saveLevel(s, level("A"));
    const b = saveLevel(s, level("B"));
    expect(a).toEqual({ ok: true, id: 1 });
    expect(b).toEqual({ ok: true, id: 2 });
    expect(listLevels(s).levels).toEqual([
      { id: 2, level: draftOf(level("B")) },
      { id: 1, level: draftOf(level("A")) },
    ]);
  });

  it("saving under an existing id replaces that level and moves it first", () => {
    const s = memory();
    saveLevel(s, level("A"));
    saveLevel(s, level("B"));
    expect(saveLevel(s, level("A2", 3), 1)).toEqual({ ok: true, id: 1 });
    expect(names(s)).toEqual(["A2", "B"]);
    expect(listLevels(s).levels[0]?.level.grid[6]).toBe("P$$$...E");
    expect(saveLevel(s, level("X"), 99)).toEqual({ ok: false, problem: "not-found" });
  });
});

describe("delete", () => {
  it("delete removes one level and keeps the others", () => {
    const s = memory();
    for (const n of ["A", "B", "C"]) saveLevel(s, level(n));
    expect(deleteLevel(s, 2)).toEqual({ ok: true, id: 2 });
    expect(names(s)).toEqual(["C", "A"]);
    expect(deleteLevel(s, 2)).toEqual({ ok: false, problem: "not-found" });
  });
});

describe("ids", () => {
  it("are unique, from a counter: a deleted id is never given again", () => {
    const s = memory();
    saveLevel(s, level("A"));
    saveLevel(s, level("B"));
    deleteLevel(s, 2);
    expect(saveLevel(s, level("C"))).toEqual({ ok: true, id: 3 });
    // 200 random saves and deletes: listed ids stay unique, saves never reuse an id.
    const rng = makeRng(31);
    const given: number[] = [];
    for (let i = 0; i < 200; i++) {
      if (randInt(rng, 3) === 0) deleteLevel(s, randInt(rng, 200) + 1);
      else {
        const r = saveLevel(s, level("x"));
        if (r.ok) given.push(r.id);
      }
    }
    expect(new Set(given).size).toBe(given.length);
    const listed = listLevels(s).levels.map((l) => l.id);
    expect(new Set(listed).size).toBe(listed.length);
  });

  it("a counter behind the stored ids (hand edit) still gives a fresh id", () => {
    const s = memory();
    saveLevel(s, level("A"));
    saveLevel(s, level("B"));
    const doc = JSON.parse(s.data.get(STORAGE_KEY) ?? "") as Record<string, unknown>;
    s.data.set(STORAGE_KEY, JSON.stringify({ ...doc, nextId: 1 }));
    expect(saveLevel(s, level("C"))).toEqual({ ok: true, id: 3 });
  });
});

describe("untrusted contents", () => {
  const stored = (levels: unknown[]): string =>
    JSON.stringify({ format: STORE_FORMAT_ID, version: 1, nextId: 9, levels });

  it("a corrupt entry is skipped and reported; the others still load", () => {
    const good = { id: 1, level: levelDocument(level("Good")) };
    const s = memory({
      [STORAGE_KEY]: stored([
        good,
        { id: 2, level: { ...levelDocument(level("Bad")), grid: [] } },
        { id: "3", level: levelDocument(level("Bad id")) },
        { id: 1, level: levelDocument(level("Duplicate id")) },
        null,
        { id: 4, level: { ...levelDocument(level("Html")), name: "<img src=x onerror=alert(1)>" } },
      ]),
    });
    const list = listLevels(s);
    expect(list.levels.map((l) => l.level.name)).toEqual(["Good", "<img src=x onerror=alert(1)>"]);
    expect(list.problems).toEqual(["corrupt-entry"]);
  });

  it("a corrupt document lists nothing with an error, and is kept until the next save", () => {
    for (const bad of [
      "{",
      "[]",
      "null",
      JSON.stringify({ format: "other", version: 1, levels: [] }),
      JSON.stringify({ format: STORE_FORMAT_ID, version: 2, levels: [] }),
      JSON.stringify({ format: STORE_FORMAT_ID, version: 1, levels: {} }),
    ]) {
      const s = memory({ [STORAGE_KEY]: bad });
      expect(listLevels(s), bad).toEqual({ levels: [], problems: ["corrupt-document"] });
      expect(s.data.get(STORAGE_KEY)).toBe(bad); // reading never writes
      expect(deleteLevel(s, 1)).toEqual({ ok: false, problem: "not-found" });
      expect(s.data.get(STORAGE_KEY)).toBe(bad);
      // The next save starts a new list and keeps the old text aside.
      expect(saveLevel(s, level("New"))).toEqual({ ok: true, id: 1 });
      expect(names(s)).toEqual(["New"]);
      expect(s.data.get(BACKUP_KEY)).toBe(bad);
    }
  });

  it("never throws on random mutations of a valid document", () => {
    const s0 = memory();
    for (const n of ["A", "B"]) saveLevel(s0, level(n));
    const valid = s0.data.get(STORAGE_KEY) ?? "";
    const rng = makeRng(32);
    const chars = '{}[]",:0123456789.-PE$@#ab ';
    for (let i = 0; i < 2000; i++) {
      let text = valid;
      for (let k = 0; k <= randInt(rng, 3); k++) {
        const at = randInt(rng, text.length);
        text = text.slice(0, at) + chars.charAt(randInt(rng, chars.length)) + text.slice(at + 1);
      }
      const s = memory({ [STORAGE_KEY]: text });
      const list = listLevels(s);
      for (const { level: l } of list.levels) expect(l.grid).toHaveLength(l.height);
    }
  });
});

describe("drafts", () => {
  it("a level that cannot be played yet (no runner, no gold, no exit) can be saved", () => {
    const s = memory();
    const draft = { name: "WIP", width: 8, height: 8, grid: Array<string>(8).fill(".".repeat(8)) };
    expect(saveLevel(s, draft)).toEqual({ ok: true, id: 1 });
    expect(listLevels(s).levels).toEqual([{ id: 1, level: draft }]);
  });

  it("a stored draft must still have a valid shape", () => {
    const s = memory({
      [STORAGE_KEY]: JSON.stringify({
        format: STORE_FORMAT_ID,
        version: 1,
        levels: [
          {
            id: 1,
            level: { ...levelDocument(level("Unknown tile")), grid: Array(8).fill("xxxxxxxx") },
          },
          { id: 2, level: { ...levelDocument(level("Too big")), width: 65 } },
        ],
      }),
    });
    expect(listLevels(s)).toEqual({ levels: [], problems: ["corrupt-entry"] });
  });
});

describe("self-review regressions", () => {
  const stored = (levels: unknown[], nextId: unknown = 9): string =>
    JSON.stringify({ format: STORE_FORMAT_ID, version: 1, nextId, levels });

  it("damaged entries are kept as they are when the list is rewritten, never erased", () => {
    const damaged = { id: 2, level: { ...levelDocument(level("From v2")), extra: true } };
    const s = memory({
      [STORAGE_KEY]: stored([{ id: 1, level: levelDocument(level("A")) }, damaged]),
    });
    saveLevel(s, level("B"));
    deleteLevel(s, 1);
    const doc = JSON.parse(s.data.get(STORAGE_KEY) ?? "") as { levels: unknown[] };
    expect(doc.levels).toContainEqual(damaged);
    expect(names(s)).toEqual(["B"]);
    // A new level never takes a damaged entry's id.
    expect(listLevels(s).levels[0]?.id).not.toBe(2);
  });

  it("a corrupt document too large to back up does not block saving", () => {
    const s = memory({ [STORAGE_KEY]: "x".repeat(1000) });
    const setItem = s.setItem.bind(s);
    s.setItem = (key, value) => {
      if (key === BACKUP_KEY) throw new DOMException("full", "QuotaExceededError");
      setItem(key, value);
    };
    expect(saveLevel(s, level("New"))).toEqual({ ok: true, id: 1 });
    expect(names(s)).toEqual(["New"]);
  });

  it("a counter at the id limit falls back to the lowest free id, which reads back", () => {
    const s = memory({
      [STORAGE_KEY]: stored([{ id: 1, level: levelDocument(level("A")) }], 2 ** 31 - 1),
    });
    expect(saveLevel(s, level("B"))).toEqual({ ok: true, id: 2 ** 31 - 1 });
    expect(saveLevel(s, level("C"))).toEqual({ ok: true, id: 2 });
    expect(names(s)).toEqual(["C", "B", "A"]);
    expect(listLevels(s).problems).toEqual([]);
  });

  it("when the read fails, nothing is written (it would erase the stored levels)", () => {
    const s = memory();
    saveLevel(s, level("A"));
    const before = s.data.get(STORAGE_KEY);
    const broken: StorageLike = {
      getItem() {
        throw new DOMException("denied", "SecurityError");
      },
      setItem: (k, v) => {
        s.setItem(k, v);
      },
    };
    expect(saveLevel(broken, level("B"))).toEqual({ ok: false, problem: "quota" });
    expect(deleteLevel(broken, 1)).toEqual({ ok: false, problem: "quota" });
    expect(s.data.get(STORAGE_KEY)).toBe(before);
  });

  it("getLevel reads the level as stored now (another tab may have saved it)", () => {
    const s = memory();
    saveLevel(s, level("A"));
    saveLevel(s, level("A, edited elsewhere", 3), 1);
    expect(getLevel(s, 1)?.level.name).toBe("A, edited elsewhere");
    expect(getLevel(s, 7)).toBeNull();
  });
});

describe("storage errors", () => {
  it("a full storage (QuotaExceededError) returns an error instead of throwing", () => {
    const s = memory();
    saveLevel(s, level("A"));
    s.full = true;
    expect(saveLevel(s, level("B"))).toEqual({ ok: false, problem: "quota" });
    expect(deleteLevel(s, 1)).toEqual({ ok: false, problem: "quota" });
    s.full = false;
    expect(names(s)).toEqual(["A"]);
  });

  it("a storage that refuses to be read (disabled) lists nothing with an error", () => {
    const s: StorageLike = {
      getItem() {
        throw new DOMException("denied", "SecurityError");
      },
      setItem() {
        throw new DOMException("denied", "SecurityError");
      },
    };
    expect(listLevels(s)).toEqual({ levels: [], problems: ["quota"] });
    expect(saveLevel(s, level("A"))).toEqual({ ok: false, problem: "quota" });
  });
});
