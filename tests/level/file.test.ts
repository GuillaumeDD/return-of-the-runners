import { describe, expect, it } from "vitest";
import { LIMITS, type Level } from "../../src/level/format";
import { exportLevel, fileName, importLevel, type LevelFile } from "../../src/level/file";
import { parseLevel } from "../../src/level/parse";
import firstSteps from "../../src/levels/first-steps.json?raw";
import { loadFixtures } from "./fixtures";

/** A fake file; `reads` counts how often its content was read. */
function file(
  text: string,
  size = new TextEncoder().encode(text).length,
): LevelFile & { reads: number } {
  return {
    size,
    reads: 0,
    text() {
      this.reads++;
      return Promise.resolve(text);
    },
  };
}

function parsed(text: string): Level {
  const r = parseLevel(text);
  if (!r.ok) throw new Error(r.errors.map((e) => e.code).join());
  return r.level;
}

describe("export then import", () => {
  const levels = [parsed(firstSteps), ...loadFixtures("valid").map((f) => parsed(f.text))];

  it("gives back the same level, and exporting it again gives byte-identical JSON", async () => {
    for (const level of levels) {
      const exported = exportLevel(level);
      const back = await importLevel(file(exported.text));
      expect(back.ok && back.level).toEqual(level);
      if (back.ok) expect(exportLevel(back.level).text).toBe(exported.text);
    }
  });

  it("a v1 file imports as the level's v2 migration, and exports as v2", async () => {
    for (const f of loadFixtures("valid", "v1")) {
      const back = await importLevel(file(f.text));
      expect(back.ok && back.level, f.file).toEqual(parsed(f.text));
      if (back.ok) {
        const doc = JSON.parse(exportLevel(back.level).text) as Record<string, unknown>;
        expect(doc.version).toBe(2);
      }
    }
  });

  it("writes teleporter links one per line, after the grid", () => {
    const fixture = loadFixtures("valid", "v2").find((f) => f.file === "v2/all-tiles.json");
    if (!fixture) throw new Error("missing v2/all-tiles.json");
    const { text } = exportLevel(parsed(fixture.text));
    expect(text).toContain('  ],\n  "teleports": [\n    [2,3,8,3],\n    [18,3,8,3]\n  ]\n}\n');
    // The fixture is written in the export layout.
    expect(text).toBe(fixture.text);
  });

  it("leaves a name that looks like a link as it is", () => {
    const fixture = loadFixtures("valid", "v2").find((f) => f.file === "v2/all-tiles.json");
    if (!fixture) throw new Error("missing v2/all-tiles.json");
    const level = { ...parsed(fixture.text), name: "[1, 2, 3, 4]" };
    const back = parsed(exportLevel(level).text);
    expect(back).toEqual(level);
  });

  it("is the v2 document, one grid row per line, with a final newline", () => {
    const { text } = exportLevel(parsed(firstSteps));
    expect(text.endsWith("}\n")).toBe(true);
    const doc = JSON.parse(text) as Record<string, unknown>;
    // No teleporters: no `teleports` field.
    expect(Object.keys(doc)).toEqual(["format", "version", "name", "width", "height", "grid"]);
    expect(doc.version).toBe(2);
    for (const row of doc.grid as string[]) expect(text).toContain(`    ${JSON.stringify(row)}`);
  });
});

describe("import rejects", () => {
  it("a file over the size cap from its size alone, without reading it", async () => {
    const big = file("{}", LIMITS.maxInputBytes + 1);
    const r = await importLevel(big);
    expect(r.ok ? [] : r.errors.map((e) => e.code)).toEqual(["too-large"]);
    expect(big.reads).toBe(0);
    // At the cap, the file is read.
    const atCap = file("{}", LIMITS.maxInputBytes);
    await importLevel(atCap);
    expect(atCap.reads).toBe(1);
  });

  it("an invalid file with the validator's errors, game rules included", async () => {
    const codes = async (text: string): Promise<string[]> => {
      const r = await importLevel(file(text));
      return r.ok ? [] : r.errors.map((e) => e.code);
    };
    expect(await codes("not json")).toEqual(["not-json"]);
    const doc = JSON.parse(firstSteps) as Record<string, unknown>;
    const grid = (doc.grid as string[]).map((row) => row.replaceAll("$", "."));
    expect(await codes(JSON.stringify({ ...doc, grid }))).toEqual(["no-gold"]);
  });

  it("a file that cannot be read, as an error instead of a rejection", async () => {
    const broken: LevelFile = { size: 10, text: () => Promise.reject(new Error("gone")) };
    const r = await importLevel(broken);
    // Regression (self-review): it was reported as "not JSON".
    expect(r.ok ? [] : r.errors.map((e) => e.code)).toEqual(["unreadable-file"]);
  });
});

describe("fileName", () => {
  it("keeps ASCII letters, digits, spaces, - and _; drops accents", () => {
    expect(fileName("Gold rush 2")).toBe("Gold rush 2.rotr.json");
    expect(fileName("Mon niveau à moi, élevé")).toBe("Mon niveau a moi- eleve.rotr.json");
    expect(fileName("黄金_run-1")).toBe("_run-1.rotr.json");
  });

  it("replaces path separators and reserved characters, never empty or hidden", () => {
    expect(fileName("../../etc/passwd")).toBe("etc-passwd.rotr.json");
    expect(fileName('a\\b:c*d?"e<f>|g')).toBe("a-b-c-d-e-f-g.rotr.json");
    expect(fileName("...")).toBe("level.rotr.json");
    expect(fileName("🏃🏃")).toBe("level.rotr.json");
    expect(fileName(".hidden")).toBe("hidden.rotr.json");
    expect(fileName("x".repeat(64))).toBe(`${"x".repeat(60)}.rotr.json`);
    // Regression (self-review): Windows refuses device names, whatever the extension.
    expect(fileName("CON")).toBe("CON-level.rotr.json");
    expect(fileName("nul")).toBe("nul-level.rotr.json");
    expect(fileName("Com1")).toBe("Com1-level.rotr.json");
    expect(fileName("Console")).toBe("Console.rotr.json");
  });
});
