import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD, WORLDS, type Level } from "../../src/level/format";
import { parseLevel } from "../../src/level/parse";
import { levelDocument } from "../../src/level/serialize";
import { levelErrorMessage } from "../../src/i18n/level-errors";
import { translate } from "../../src/i18n";
import { WORLD_NAME } from "../../src/i18n/worlds";
import { decodeLevel, toBase64url } from "../../src/share/link";
import {
  STORAGE_KEY,
  STORE_FORMAT_ID,
  listLevels,
  type StorageLike,
} from "../../src/storage/levels";
import { loadFixtures } from "./fixtures";

function parsed(text: string): Level {
  const r = parseLevel(text);
  if (!r.ok) throw new Error(r.errors.map((e) => e.code).join());
  return r.level;
}

const v2 = loadFixtures("valid", "v2");
const v3 = loadFixtures("valid", "v3");

describe("v2 → v3 migration", () => {
  it("reads every v2 fixture as a v3 level in the default world (Moss), by day", () => {
    expect(DEFAULT_WORLD).toBe("moss");
    for (const f of v2) {
      const level = parsed(f.text);
      expect(level.version, f.file).toBe(3);
      expect([level.world, level.night], f.file).toEqual(["moss", false]);
    }
  });

  it("keeps everything else of a v2 level: the same as its v3 twin but for world and night", () => {
    for (const f of v2) {
      const twin = v3.find((g) => g.file === f.file.replace("v2/", "v3/"));
      if (!twin) throw new Error(`no v3 twin for ${f.file}`);
      const a = parsed(f.text);
      const b = parsed(twin.text);
      expect({ ...a, world: b.world, night: b.night }, f.file).toEqual(b);
    }
  });

  it("writes a migrated level back as v3, and that reads back the same", () => {
    for (const f of v2) {
      const level = parsed(f.text);
      const doc = levelDocument(level);
      expect(doc.version).toBe(3);
      expect(parsed(JSON.stringify(doc))).toEqual(level);
    }
  });

  it("refuses the v3 fields in a v2 document", () => {
    const doc = { ...(JSON.parse(v2[0]?.text ?? "{}") as object), world: "lava" };
    const r = parseLevel(JSON.stringify(doc));
    expect(r.ok ? [] : r.errors.map((e) => e.code)).toEqual(["unknown-field"]);
  });

  it("migrates a v2 level kept in My levels", () => {
    const doc = JSON.parse(v2.find((f) => f.file === "v2/minimal-8x8.json")?.text ?? "") as object;
    const data = new Map([
      [
        STORAGE_KEY,
        JSON.stringify({
          format: STORE_FORMAT_ID,
          version: 1,
          nextId: 2,
          levels: [{ id: 1, level: doc }],
        }),
      ],
    ]);
    const store: StorageLike = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => {
        data.set(k, v);
      },
    };
    const { levels, problems } = listLevels(store);
    expect(problems).toEqual([]);
    expect(levels.map((l) => [l.level.world, l.level.night])).toEqual([["moss", false]]);
  });

  it("migrates a v2 share link", async () => {
    const text = v2.find((f) => f.file === "v2/minimal-8x8.json")?.text ?? "";
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const payload = toBase64url(new Uint8Array(await new Response(stream).arrayBuffer()));
    const r = await decodeLevel(payload);
    expect(r.ok && [r.level.version, r.level.world, r.level.night]).toEqual([3, "moss", false]);
  });
});

describe("v3 world and night", () => {
  it("has a valid fixture for every world, by day and by night", () => {
    const seen = v3.map((f) => parsed(f.text));
    for (const w of WORLDS) expect(seen.map((l) => l.world)).toContain(w);
    expect(new Set(seen.map((l) => l.night))).toEqual(new Set([true, false]));
  });

  it("reads the world and night a v3 document names", () => {
    for (const f of v3) {
      const doc = JSON.parse(f.text) as { world: string; night: boolean };
      const level = parsed(f.text);
      expect([level.world, level.night], f.file).toEqual([doc.world, doc.night]);
    }
  });

  it("gives every world a name in each language, all different", () => {
    for (const locale of ["en", "fr"] as const) {
      const names = WORLDS.map((w) => translate(locale, WORLD_NAME[w]));
      for (const n of names) expect(n.length).toBeGreaterThan(0);
      expect(new Set(names).size).toBe(WORLDS.length);
    }
  });

  it("translates the new errors", () => {
    for (const code of ["invalid-world", "invalid-night"] as const) {
      const en = levelErrorMessage("en", code);
      const fr = levelErrorMessage("fr", code);
      expect(en.length).toBeGreaterThan(0);
      expect(fr.length).toBeGreaterThan(0);
      expect(fr).not.toBe(en);
    }
  });
});
