import { describe, expect, it } from "vitest";
import { catalog, LOCALES } from "../../src/i18n";
import { TILE, TILE_CHARS_V1 } from "../../src/level/format";
import { PALETTE, shortcutFor, tileForKey } from "../../src/editor/keys";

const key = (
  k: string,
  mods: Partial<Record<"ctrl" | "meta" | "shift" | "alt", boolean>> = {},
) => ({
  key: k,
  ctrlKey: mods.ctrl ?? false,
  metaKey: mods.meta ?? false,
  shiftKey: mods.shift ?? false,
  altKey: mods.alt ?? false,
});

describe("palette", () => {
  it("holds every v1 tile once, and every tile name is translated", () => {
    // The v2 tiles join the palette with their behavior (B-020 to B-028).
    expect(new Set(PALETTE.map((p) => p.tile))).toEqual(TILE_CHARS_V1);
    expect(PALETTE).toHaveLength(TILE_CHARS_V1.size);
    for (const locale of LOCALES) {
      for (const { name } of PALETTE) expect(catalog(locale)[name].trim()).not.toBe("");
    }
  });

  it("number keys 1–9 (top row or numpad) pick the palette entries in order", () => {
    PALETTE.forEach(({ tile }, i) => {
      expect(tileForKey(`Digit${String(i + 1)}`)).toBe(tile);
      expect(tileForKey(`Numpad${String(i + 1)}`)).toBe(tile);
    });
    expect(tileForKey("Digit1")).toBe(TILE.brick);
    for (const code of ["Digit0", "Numpad0", "KeyA", "Digit10", "digit1", ""]) {
      expect(tileForKey(code), code).toBeNull();
    }
  });
});

describe("shortcuts", () => {
  it("Ctrl+Z undoes; Ctrl+Y and Ctrl+Shift+Z redo; Cmd works like Ctrl", () => {
    expect(shortcutFor(key("z", { ctrl: true }))).toBe("undo");
    expect(shortcutFor(key("Z", { ctrl: true }))).toBe("undo");
    expect(shortcutFor(key("z", { meta: true }))).toBe("undo");
    expect(shortcutFor(key("y", { ctrl: true }))).toBe("redo");
    expect(shortcutFor(key("Z", { ctrl: true, shift: true }))).toBe("redo");
    expect(shortcutFor(key("z", { meta: true, shift: true }))).toBe("redo");
  });

  it("without Ctrl or Cmd, with Alt, or another letter: no shortcut", () => {
    expect(shortcutFor(key("z"))).toBeNull();
    expect(shortcutFor(key("z", { ctrl: true, alt: true }))).toBeNull();
    expect(shortcutFor(key("y", { ctrl: true, shift: true }))).toBeNull();
    expect(shortcutFor(key("x", { ctrl: true }))).toBeNull();
  });
});
