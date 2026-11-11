import { describe, expect, it } from "vitest";
import { translate } from "../../src/i18n";
import { parseLevel } from "../../src/level/parse";
import { PACK, nextIndex } from "../../src/levels/pack";

describe("bundled pack", () => {
  it("every level parses with no errors", () => {
    for (const entry of PACK) {
      const r = parseLevel(entry.text);
      expect([entry.id, r.ok ? [] : r.errors]).toEqual([entry.id, []]);
    }
  });

  it("ids are unique and plain (progress is stored by id)", () => {
    const ids = PACK.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{1,32}$/);
  });

  it("every title has an English and a French text; the English one is the file's name", () => {
    for (const entry of PACK) {
      const r = parseLevel(entry.text);
      expect(translate("fr", entry.title)).not.toBe("");
      expect(r.ok && r.level.name).toBe(translate("en", entry.title));
    }
  });

  it("the level after the last one is the first", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
    expect(nextIndex(0, 1)).toBe(0);
  });
});
