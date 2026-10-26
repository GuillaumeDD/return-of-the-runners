import { describe, expect, it } from "vitest";
import { TILE } from "../../src/level/format";
import {
  afterEdit,
  isDirty,
  isProblem,
  relabelTracking,
  statusKey,
  statusText,
  type Notice,
} from "../../src/editor/library";
import { translate } from "../../src/i18n";
import { levelErrorMessage } from "../../src/i18n/level-errors";
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

describe("status line", () => {
  const s = newEditor("My level");
  const unsaved = { id: null, saved: s };
  const saved = { id: 1, saved: s };

  it("with no notice, shows the save status", () => {
    expect(statusText("en", null, s, saved)).toBe(translate("en", "statusSaved"));
    expect(statusText("fr", null, s, unsaved)).toBe(translate("fr", "statusUnsaved"));
  });

  // Regression (self-review): "Export started" replaced "not saved yet".
  it("an info notice is followed by the save status", () => {
    const notice: Notice = { kind: "info", key: "statusExported" };
    expect(statusText("en", notice, s, unsaved)).toBe(
      `${translate("en", "statusExported")} ${translate("en", "statusUnsaved")}`,
    );
    expect(statusText("fr", notice, s, saved)).toBe(
      `${translate("fr", "statusExported")} ${translate("fr", "statusSaved")}`,
    );
  });

  it("a level notice shows its prefix, then each translated error", () => {
    const notice: Notice = {
      kind: "level",
      prefix: "importRefused",
      codes: ["no-gold", "unreadable-file"],
    };
    expect(statusText("fr", notice, s, saved)).toBe(
      [
        translate("fr", "importRefused"),
        levelErrorMessage("fr", "no-gold"),
        levelErrorMessage("fr", "unreadable-file"),
      ].join(" "),
    );
    const bare: Notice = { kind: "level", prefix: null, codes: ["no-exit"] };
    expect(statusText("en", bare, s, saved)).toBe(levelErrorMessage("en", "no-exit"));
  });

  it("storage problems are translated, one after the other", () => {
    const notice: Notice = { kind: "storage", problems: ["quota", "corrupt-entry"] };
    expect(statusText("en", notice, s, saved)).toBe(
      `${translate("en", "storageQuota")} ${translate("en", "storageCorruptEntry")}`,
    );
  });

  it("only refusals and storage problems are problems; an edit keeps only storage ones", () => {
    const storage: Notice = { kind: "storage", problems: ["quota"] };
    const level: Notice = { kind: "level", prefix: "exportRefused", codes: ["no-gold"] };
    const info: Notice = { kind: "info", key: "statusExported" };
    expect([null, storage, level, info].map(isProblem)).toEqual([false, true, true, false]);
    expect(afterEdit(storage)).toBe(storage);
    expect(afterEdit(level)).toBeNull();
    expect(afterEdit(info)).toBeNull();
    expect(afterEdit(null)).toBeNull();
  });
});
