import { describe, expect, it } from "vitest";
import { parseSize, relabelName } from "../../src/editor/fields";
import { resize, newEditor } from "../../src/editor/model";

describe("parseSize", () => {
  it("reads whole numbers, spaces around them allowed", () => {
    expect(parseSize("28")).toBe(28);
    expect(parseSize(" 64 ")).toBe(64);
    expect(parseSize("0")).toBe(0);
  });

  // Regression (self-review): Number("") is 0, so emptying a size field cropped the
  // level to 8 cells.
  it("anything else is NaN, which resize treats as keeping the current size", () => {
    for (const text of ["", "  ", "-5", "2.5", "1e2", "abc", "12345"]) {
      expect(parseSize(text), text).toBeNaN();
    }
    const s = newEditor("t");
    expect(resize(s, parseSize(""), parseSize("16"))).toBe(s);
  });
});

describe("relabelName", () => {
  // Regression (self-review): the default name stayed in the language of page load.
  it("the default name follows a language switch; a typed name stays", () => {
    expect(relabelName("My level", "en", "fr")).toBe("Mon niveau");
    expect(relabelName("Mon niveau", "fr", "en")).toBe("My level");
    expect(relabelName("Gold rush", "en", "fr")).toBe("Gold rush");
    expect(relabelName("Mon niveau", "en", "fr")).toBe("Mon niveau");
  });
});
