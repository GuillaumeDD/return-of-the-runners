import { describe, expect, it } from "vitest";
import { TILE } from "../../src/level/format";
import { PLAY_SEED, createSession } from "../../src/game/session";
import { createState } from "../../src/sim/state";
import { hashState } from "../../src/sim/hash";
import { newEditor, paint, rename, type EditorState } from "../../src/editor/model";
import { startTest, testErrors } from "../../src/editor/test-play";

const valid = (): EditorState => {
  let s = newEditor("Test");
  s = paint(s, 1, 14, TILE.runnerStart);
  s = paint(s, 5, 14, TILE.gold);
  s = paint(s, 9, 14, TILE.exit);
  return paint(s, 12, 14, TILE.monkStart);
};

describe("startTest", () => {
  it("a valid level starts a session whose start state is createState(level, seed)", () => {
    const r = startTest(valid());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.level.grid).toEqual(valid().grid);
    expect(r.session).toEqual(createSession(createState(r.level, PLAY_SEED)));
    expect(hashState(r.session.state)).toBe(hashState(createState(r.level, PLAY_SEED)));
    // Another seed gives that seed's start.
    const other = startTest(valid(), 7);
    if (other.ok) expect(other.session.start).toEqual(createState(other.level, 7));
  });

  it("an invalid level returns its error codes, each once, and starts nothing", () => {
    const r = startTest(newEditor("t"));
    expect(r).toEqual({ ok: false, errors: ["runner-count", "no-gold", "no-exit"] });
    expect(startTest(rename(valid(), " "))).toEqual({ ok: false, errors: ["invalid-name"] });
    // The same codes without building a game; null once the level can be tested.
    expect(testErrors(newEditor("t"))).toEqual(["runner-count", "no-gold", "no-exit"]);
    expect(testErrors(valid())).toBeNull();
  });

  it("leaves the editor state as it was (same grid, same undo stack)", () => {
    const s = paint(valid(), 3, 3, TILE.brick);
    const before = structuredClone(s);
    startTest(s);
    expect(s).toEqual(before);
    expect(s.undo).toHaveLength(5);
  });
});
