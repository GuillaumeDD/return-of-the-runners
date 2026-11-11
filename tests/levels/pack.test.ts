import { describe, expect, it } from "vitest";
import { translate } from "../../src/i18n";
import { parseLevel } from "../../src/level/parse";
import { PACKS, nextIndex, packModes, packStartMode, progressKey } from "../../src/levels/pack";
import { maxPlayers } from "../../src/sim/state";

const entries = PACKS.flatMap((pack) => pack.levels.map((entry) => ({ pack, entry })));

describe("bundled packs", () => {
  it("a pack for one player and a pack for two, each with levels", () => {
    expect(PACKS.map((p) => [p.id, p.players])).toEqual([
      ["solo", 1],
      ["duo", 2],
    ]);
    for (const pack of PACKS) expect(pack.levels.length).toBeGreaterThan(0);
  });

  it("every level parses with no errors", () => {
    for (const { pack, entry } of entries) {
      const r = parseLevel(entry.text);
      expect([progressKey(pack, entry), r.ok ? [] : r.errors]).toEqual([
        progressKey(pack, entry),
        [],
      ]);
    }
  });

  it("every level of the two-player pack has a player 2 start", () => {
    for (const { pack, entry } of entries.filter((e) => e.pack.players === 2)) {
      const r = parseLevel(entry.text);
      expect([progressKey(pack, entry), r.ok && maxPlayers(r.level)]).toEqual([
        progressKey(pack, entry),
        2,
      ]);
    }
  });

  it("ids are plain and unique within a pack, so progress keys are unique", () => {
    const keys = entries.map(({ pack, entry }) => progressKey(pack, entry));
    expect(new Set(keys).size).toBe(keys.length);
    for (const { entry } of entries) expect(entry.id).toMatch(/^[a-z0-9-]{1,32}$/);
  });

  it("every title has an English and a French text; the English one is the file's name", () => {
    for (const pack of PACKS) expect(translate("fr", pack.title)).not.toBe("");
    for (const { entry } of entries) {
      const r = parseLevel(entry.text);
      expect(translate("fr", entry.title)).not.toBe("");
      expect(r.ok && r.level.name).toBe(translate("en", entry.title));
    }
  });

  it("the one-player pack plays alone; the two-player pack offers co-op and versus", () => {
    expect(packModes({ players: 1 })).toEqual(["solo"]);
    expect(packModes({ players: 2 })).toEqual(["coop", "versus"]);
  });

  it("a level starts alone, in its own mode, or in the two-player mode picked last", () => {
    expect(packStartMode({ players: 1 }, { mode: "versus" }, "coop")).toBe("solo");
    expect(packStartMode({ players: 2 }, { mode: "versus" }, "coop")).toBe("versus");
    expect(packStartMode({ players: 2 }, {}, "versus")).toBe("versus");
    expect(packStartMode({ players: 2 }, {}, "solo")).toBe("coop");
  });

  it("the level after the last one is the first", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
    expect(nextIndex(0, 1)).toBe(0);
  });
});
