import { describe, expect, it } from "vitest";
import { TILE } from "../../src/level/format";
import { maxPlayers } from "../../src/sim/state";
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
  it("a valid level gives the level to play, with the editor's grid", () => {
    const r = startTest(valid());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.level.grid).toEqual(valid().grid);
    expect(maxPlayers(r.level)).toBe(1);
    // A player 2 start makes it playable by two.
    const two = startTest(paint(valid(), 2, 14, TILE.player2Start));
    expect(two.ok && maxPlayers(two.level)).toBe(2);
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
