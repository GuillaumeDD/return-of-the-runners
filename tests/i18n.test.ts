import { describe, expect, it } from "vitest";
import { catalog, detectLocale, LOCALES, translate } from "../src/i18n";
import { LEVEL_ERROR_MESSAGE, levelErrorMessage } from "../src/i18n/level-errors";
import { LIMITS, type LevelErrorCode } from "../src/level/format";

describe("i18n catalogs", () => {
  it("every locale has exactly the same keys as English", () => {
    const enKeys = Object.keys(catalog("en")).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(catalog(locale)).sort()).toEqual(enKeys);
    }
  });

  it("no translation is empty", () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(catalog(locale))) {
        expect(value.trim(), `${locale}.${key}`).not.toBe("");
      }
    }
  });

  it("translate returns the locale's string", () => {
    expect(translate("en", "switchLanguage")).toBe("Français");
    expect(translate("fr", "switchLanguage")).toBe("English");
  });
});

describe("level error messages", () => {
  it("every level error code has its own EN and FR message", () => {
    const keys = Object.values(LEVEL_ERROR_MESSAGE);
    expect(new Set(keys).size).toBe(keys.length);
    for (const locale of LOCALES) {
      for (const key of keys)
        expect(translate(locale, key).trim(), `${locale}.${key}`).not.toBe("");
    }
  });

  // Regression (self-review): the messages repeated the format's limits by hand.
  it("messages show the format's limits, with every placeholder filled", () => {
    for (const locale of LOCALES) {
      for (const code of Object.keys(LEVEL_ERROR_MESSAGE) as LevelErrorCode[]) {
        expect(levelErrorMessage(locale, code), `${locale} ${code}`).not.toMatch(/[{}]/);
      }
      expect(levelErrorMessage(locale, "too-many-monks")).toContain(String(LIMITS.maxMonks));
      expect(levelErrorMessage(locale, "invalid-name")).toContain(String(LIMITS.maxNameLength));
      expect(levelErrorMessage(locale, "invalid-dimension")).toContain(String(LIMITS.maxHeight));
    }
  });
});

describe("detectLocale", () => {
  it("picks the first supported language, ignoring region and case", () => {
    expect(detectLocale(["fr-FR", "en-US"])).toBe("fr");
    expect(detectLocale(["EN-gb"])).toBe("en");
    expect(detectLocale(["de-DE", "fr-CA"])).toBe("fr");
  });

  it("falls back to English", () => {
    expect(detectLocale([])).toBe("en");
    expect(detectLocale(["de", "ja"])).toBe("en");
  });
});
