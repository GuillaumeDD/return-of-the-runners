import { describe, expect, it } from "vitest";
import { LIMITS } from "../../src/level/format";
import { parseLevel } from "../../src/level/parse";
import { loadFixtures } from "./fixtures";
import { expectLevelInvariants } from "./invariants";

const validFixtures = loadFixtures("valid");
const invalidFixtures = loadFixtures("invalid");
const minimal = validFixtures.find((f) => f.file === "minimal-8x8.json");
if (!minimal) throw new Error("missing minimal-8x8.json fixture");

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
      "version",
      "width",
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
    const polluted = invalidFixtures.find((f) => f.file === "unknown-field--proto.json");
    if (!polluted) throw new Error("missing fixture");
    parseLevel(polluted.text);
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
