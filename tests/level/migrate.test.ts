import { describe, expect, it } from "vitest";
import { migrateV1 } from "../../src/level/migrate";
import { parseLevel } from "../../src/level/parse";
import { loadFixtures } from "./fixtures";
import { expectLevelInvariants } from "./invariants";

function doc(text: string): Record<string, unknown> {
  return JSON.parse(text) as Record<string, unknown>;
}

describe("migrateV1", () => {
  it.each(loadFixtures("valid", "v1").map((f) => [f.file, f] as const))(
    "migrates %s to a v2 document that validates, with the same grid",
    (_, fixture) => {
      const v1 = doc(fixture.text);
      const migrated = migrateV1(v1);
      if (!migrated.ok) throw new Error(migrated.error.detail);
      expect(migrated.doc.version).toBe(2);
      expect(Object.keys(migrated.doc)).toEqual([
        "format",
        "version",
        "name",
        "width",
        "height",
        "grid",
      ]);
      const parsed = parseLevel(JSON.stringify(migrated.doc));
      if (!parsed.ok) throw new Error(parsed.errors.map((e) => e.code).join());
      expectLevelInvariants(parsed.level);
      expect(parsed.level.grid).toEqual(v1.grid);
      expect(parsed.level.name).toBe(v1.name);
      expect(parsed.level.teleports).toEqual([]);
      // Reading the v1 text gives the same level as reading its migration.
      expect(parseLevel(fixture.text)).toEqual(parsed);
    },
  );

  it("refuses to migrate twice: a v2 document is not migrated again", () => {
    const v1 = doc(loadFixtures("valid", "v1")[0]?.text ?? "{}");
    const once = migrateV1(v1);
    if (!once.ok) throw new Error(once.error.detail);
    const twice = migrateV1(once.doc);
    expect(twice.ok ? null : twice.error.code).toBe("unsupported-version");
  });

  it("is pure: the v1 document is not changed", () => {
    const v1 = doc(loadFixtures("valid", "v1")[0]?.text ?? "{}");
    const copy = structuredClone(v1);
    migrateV1(v1);
    expect(v1).toEqual(copy);
  });

  it.each(loadFixtures("invalid", "v1").map((f) => [f.file, f] as const))(
    "leaves %s invalid, with the same error code",
    (_, fixture) => {
      const r = parseLevel(fixture.text);
      expect(r.ok ? [] : r.errors.map((e) => e.code)).toEqual([fixture.expectedCode]);
    },
  );
});
