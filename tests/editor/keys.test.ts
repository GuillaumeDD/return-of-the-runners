import { describe, expect, it } from "vitest";
import { catalog, LOCALES } from "../../src/i18n";
import { TILE, TILE_BASE } from "../../src/level/format";
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
  it("holds every base tile, the player 2 start, the terrain, the teleporters, keys, doors, tools and bombs once; every name is translated", () => {
    // The other v2 tiles join the palette with their behavior (B-027, B-028).
    const expected = new Set([
      ...Object.values(TILE_BASE),
      TILE.player2Start,
      TILE.trapdoor,
      TILE.gooeyTurf,
      TILE.hiddenLadder,
      TILE.alcove,
      TILE.monkRespawn,
      TILE.teleportEntrance,
      TILE.teleportExit,
      TILE.keyRed,
      TILE.keyGreen,
      TILE.keyBlue,
      TILE.doorRed,
      TILE.doorGreen,
      TILE.doorBlue,
      TILE.jackhammer,
      TILE.pickaxe,
      TILE.smallBomb,
      TILE.bigBomb,
    ]);
    expect(new Set(PALETTE.map((p) => p.tile))).toEqual(expected);
    expect(PALETTE).toHaveLength(expected.size);
    for (const locale of LOCALES) {
      for (const { name } of PALETTE) expect(catalog(locale)[name].trim()).not.toBe("");
    }
  });

  it("number keys 1–9, then 0 (top row or numpad) pick the palette entries in order", () => {
    PALETTE.slice(0, 10).forEach(({ tile }, i) => {
      const digit = String((i + 1) % 10);
      expect(tileForKey(`Digit${digit}`)).toBe(tile);
      expect(tileForKey(`Numpad${digit}`)).toBe(tile);
    });
    expect(tileForKey("Digit1")).toBe(TILE.brick);
    expect(tileForKey("Digit0")).toBe(TILE.player2Start);
    for (const code of ["KeyA", "Digit10", "digit1", ""]) {
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
