import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLevel } from "../../src/level/parse";
import { maxPlayers } from "../../src/sim/state";
import { replayFixtures } from "../helpers/replays";

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

  it("the play screen's level can be played by two (it has a player 2 start)", () => {
    const result = parseLevel(readFileSync(join(DIR, "first-steps.json"), "utf8"));
    expect(result.ok && maxPlayers(result.level)).toBe(2);
  });

  it("the play screen's level can be won with its monk: the default-level replay plays it", () => {
    const result = parseLevel(readFileSync(join(DIR, "first-steps.json"), "utf8"));
    const replay = replayFixtures().find((f) => f.name === "default-level");
    // The replay's own tick, status and hash are checked with the other replays.
    expect(replay?.expected.status).toBe("won");
    expect(result.ok && result.level).toEqual(replay?.replay.level);
  });
});
