import { describe, expect, it } from "vitest";
import { LIMITS, TILE, TILE_BASE, TILE_CHARS } from "../../src/level/format";
import { parseLevel } from "../../src/level/parse";
import { FIXTURE_VERSIONS, loadFixtures } from "./fixtures";
import { expectLevelInvariants } from "./invariants";

const validFixtures = loadFixtures("valid");
const invalidFixtures = loadFixtures("invalid");
const minimal = validFixtures.find((f) => f.file === "v2/minimal-8x8.json");
if (!minimal) throw new Error("missing v2/minimal-8x8.json fixture");

function codes(text: string): string[] {
  const result = parseLevel(text);
  return result.ok ? [] : result.errors.map((e) => e.code);
}

describe("parseLevel: valid fixtures", () => {
  it.each(validFixtures.map((f) => [f.file, f] as const))("accepts %s", (_, fixture) => {
    const result = parseLevel(fixture.text);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok) expectLevelInvariants(result.level);
  });

  it("returns exactly the documented fields", () => {
    const result = parseLevel(minimal.text);
    if (!result.ok) throw new Error("expected ok");
    expect(Object.keys(result.level).sort()).toEqual([
      "grid",
      "height",
      "name",
      "night",
      "teleports",
      "version",
      "width",
      "world",
    ]);
  });
});

describe("parseLevel: invalid fixtures", () => {
  it.each(invalidFixtures.map((f) => [f.file, f] as const))(
    "rejects %s with exactly its error code",
    (_, fixture) => {
      expect(codes(fixture.text)).toEqual([fixture.expectedCode]);
    },
  );

  it("has an invalid fixture for every content error code", () => {
    const covered = new Set(invalidFixtures.map((f) => f.expectedCode));
    for (const code of [
      "player2-count",
      "invalid-teleports",
      "teleport-out-of-grid",
      "teleport-not-entrance",
      "teleport-not-exit",
      "teleport-duplicate",
      "teleport-unlinked",
      "not-json",
      "not-object",
      "wrong-format",
      "unsupported-version",
      "missing-field",
      "unknown-field",
      "invalid-name",
      "invalid-dimension",
      "invalid-grid",
      "row-count",
      "row-length",
      "unknown-tile",
      "runner-count",
      "no-gold",
      "no-exit",
      "too-many-monks",
      "invalid-world",
      "invalid-night",
    ]) {
      expect(covered, code).toContain(code);
    }
  });
});

describe("parseLevel: limits and robustness", () => {
  it("rejects input larger than the byte limit", () => {
    const padded = minimal.text.replace("{", `{"pad":"${"x".repeat(LIMITS.maxInputBytes)}",`);
    expect(codes(padded)).toEqual(["too-large"]);
  });

  it("measures the limit in UTF-8 bytes, not characters", () => {
    // 3 bytes per "€": under the limit in characters, over it in bytes.
    const euros = "€".repeat(Math.ceil(LIMITS.maxInputBytes / 3) + 1);
    expect(euros.length).toBeLessThan(LIMITS.maxInputBytes);
    expect(codes(euros)).toEqual(["too-large"]);
  });

  it("returns all content errors at once, not just the first", () => {
    const doc = JSON.parse(minimal.text) as Record<string, unknown>;
    doc.name = "";
    doc.extra = true;
    doc.grid = (doc.grid as string[]).map((r) => r.replace("$", ".").replace("E", "."));
    expect(codes(JSON.stringify(doc)).sort()).toEqual(
      ["invalid-name", "no-exit", "no-gold", "unknown-field"].sort(),
    );
  });

  it("does not let __proto__ pollute Object.prototype", () => {
    const polluted = invalidFixtures.filter((f) => f.file.endsWith("/unknown-field--proto.json"));
    expect(polluted).toHaveLength(FIXTURE_VERSIONS.length);
    for (const f of polluted) parseLevel(f.text);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("returns a copy of the grid, not the parsed array", () => {
    const a = parseLevel(minimal.text);
    const b = parseLevel(minimal.text);
    if (!a.ok || !b.ok) throw new Error("expected ok");
    expect(a.level.grid).not.toBe(b.level.grid);
    expect(a.level.grid).toEqual(b.level.grid);
  });

  it.each([
    ["empty string", ""],
    ["whitespace", "   "],
    ["number", "42"],
    ["string", '"level"'],
    ["deep nesting", "[".repeat(5000) + "]".repeat(5000)],
  ])("never throws on %s", (_, text) => {
    expect(() => parseLevel(text)).not.toThrow();
    expect(parseLevel(text).ok).toBe(false);
  });
});

describe("parseLevel: drafts (gameRules: false)", () => {
  const draft = (grid: string[]): string =>
    JSON.stringify({
      format: "return-of-the-runners/level",
      version: 2,
      name: "WIP",
      width: 8,
      height: 8,
      grid,
    });
  const empty = Array<string>(8).fill("........");

  it("accepts a level with no runner, no gold, no exit, or too many monks", () => {
    expect(parseLevel(draft(empty), { gameRules: false }).ok).toBe(true);
    const monks = [...empty.slice(0, 5), "MMMMMMMM", "MMMMMMMM", "MMMMMMMM"];
    expect(parseLevel(draft(monks), { gameRules: false }).ok).toBe(true);
    // The same levels fail the full check.
    const full = parseLevel(draft(empty));
    expect(full.ok ? [] : full.errors.map((e) => e.code)).toEqual([
      "runner-count",
      "no-gold",
      "no-exit",
    ]);
  });

  it("still rejects a broken shape: unknown tiles, wrong row count or length", () => {
    const codes = (grid: string[]): string[] => {
      const r = parseLevel(draft(grid), { gameRules: false });
      return r.ok ? [] : r.errors.map((e) => e.code);
    };
    expect(codes([...empty.slice(1), "...x...."])).toEqual(["unknown-tile"]);
    expect(codes(empty.slice(1))).toEqual(["row-count"]);
    expect(codes([...empty.slice(1), "..."])).toEqual(["row-length"]);
  });
});

describe("parseLevel: version 2", () => {
  const doc = (row5: string, extra: Record<string, unknown> = {}): string =>
    JSON.stringify({
      format: "return-of-the-runners/level",
      version: 2,
      name: "V2",
      width: 8,
      height: 8,
      grid: [...Array<string>(5).fill("........"), row5, ".P...E$.", "########"],
      ...extra,
    });

  it("has 30 tiles, each a distinct single ASCII character, the base tiles among them", () => {
    expect(TILE_CHARS.size).toBe(Object.keys(TILE).length);
    expect(TILE_CHARS.size).toBe(30);
    for (const c of TILE_CHARS) expect(c).toMatch(/^[\x21-\x7e]$/);
    for (const c of Object.values(TILE_BASE)) expect(TILE_CHARS.has(c)).toBe(true);
  });

  const base: ReadonlySet<string> = new Set(Object.values(TILE_BASE));
  it.each([...TILE_CHARS].filter((c) => !base.has(c) && c !== TILE.teleportEntrance))(
    "accepts the new tile %s",
    (c) => {
      expect(codes(doc(`${c}.......`))).toEqual([]);
    },
  );

  it("accepts a linked teleporter entrance, and an exit with no entrance", () => {
    const r = parseLevel(doc(".T....t.", { teleports: [[1, 5, 6, 5]] }));
    expect(r.ok && r.level.teleports).toEqual([[1, 5, 6, 5]]);
    expect(codes(doc("......t."))).toEqual([]);
  });

  it("lets several entrances lead to one exit", () => {
    const links = [
      [1, 5, 6, 5],
      [3, 5, 6, 5],
    ];
    expect(codes(doc(".T.T..t.", { teleports: links }))).toEqual([]);
  });

  it("gives an unknown character its code, and a teleports field no level", () => {
    expect(codes(doc("x......."))).toEqual(["unknown-tile"]);
    expect(codes(doc(".T....t.", { teleports: "1,5,6,5" }))).toEqual(["invalid-teleports"]);
  });

  it("reports each teleporter problem once, all problems together", () => {
    const links = [
      [2, 5, 7, 5],
      [3, 5, 7, 5],
      [1, 5, 7, 5],
      [1, 5, 6, 5],
      [9, 9, 6, 5],
    ];
    expect(codes(doc(".T.T..t.", { teleports: links })).sort()).toEqual(
      [
        "teleport-duplicate",
        "teleport-not-entrance",
        "teleport-not-exit",
        "teleport-out-of-grid",
      ].sort(),
    );
  });

  it("does not check links against a broken grid (its errors are enough)", () => {
    const broken = JSON.parse(doc(".T....t.", { teleports: [[1, 5, 6, 5]] })) as {
      grid: string[];
    };
    broken.grid.pop();
    expect(codes(JSON.stringify(broken))).toEqual(["row-count"]);
  });

  it("checks links and the player 2 count as game rules, not for drafts", () => {
    const draft = (text: string): boolean => parseLevel(text, { gameRules: false }).ok;
    expect(draft(doc(".T....tT", { teleports: [[9, 9, 0, 0]] }))).toBe(true);
    expect(draft(doc(".Q....Q."))).toBe(true);
    expect(draft(doc("........", { teleports: [[1]] }))).toBe(false);
  });

  it("refuses a version 1 document: v1 was dropped before anyone used it", () => {
    const v1 = JSON.parse(doc("........")) as Record<string, unknown>;
    expect(codes(JSON.stringify({ ...v1, version: 1 }))).toEqual(["unsupported-version"]);
  });
});
