import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLevel } from "../../src/level/parse";

const DIR = join(import.meta.dirname, "../../src/levels");
const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));

describe("bundled levels", () => {
  it("there is at least one", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s parses with no errors", (file) => {
    const result = parseLevel(readFileSync(join(DIR, file), "utf8"));
    expect(result.ok ? [] : result.errors).toEqual([]);
  });
});
