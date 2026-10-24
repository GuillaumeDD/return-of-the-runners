import { describe, expect, it } from "vitest";
import { catalog, detectLocale, LOCALES, translate } from "../src/i18n";

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
