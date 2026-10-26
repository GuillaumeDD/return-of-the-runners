import { describe, expect, it } from "vitest";
import { TILE } from "../../src/level/format";
import { isDirty, relabelTracking, statusKey } from "../../src/editor/library";
import { newEditor, paint, rename, undo } from "../../src/editor/model";

describe("status", () => {
  it("a level never saved is 'not saved yet', even with no change", () => {
    const s = newEditor("My level");
    expect(statusKey(s, { id: null, saved: s })).toBe("statusUnsaved");
  });

  it("a saved level is 'saved' until it changes, and again after an undo", () => {
    const s = newEditor("My level");
    const t = { id: 1, saved: s };
    expect(statusKey(s, t)).toBe("statusSaved");
    const changed = paint(s, 1, 1, TILE.gold);
    expect(isDirty(changed, t)).toBe(true);
    expect(statusKey(changed, t)).toBe("statusUnsaved");
    expect(statusKey(undo(changed), t)).toBe("statusSaved");
    expect(isDirty(rename(s, "Other"), t)).toBe(true);
  });
});

describe("language switch", () => {
  // Regression (self-review): switching language made a saved level with the default
  // name look saved under the new name.
  it("the default name of a never-saved level follows; a saved level's stays", () => {
    const s = newEditor("My level");
    const fresh = relabelTracking({ id: null, saved: s }, "en", "fr");
    expect(fresh.saved.name).toBe("Mon niveau");
    expect(isDirty(rename(s, "Mon niveau"), fresh)).toBe(false);
    const saved = relabelTracking({ id: 3, saved: s }, "en", "fr");
    expect(saved.saved.name).toBe("My level");
    expect(isDirty(rename(s, "Mon niveau"), saved)).toBe(true);
  });
});
