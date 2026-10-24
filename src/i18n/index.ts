import en from "./en.json";
import fr from "./fr.json";

export type Locale = "en" | "fr";
export type MessageKey = keyof typeof en;

export const LOCALES: readonly Locale[] = ["en", "fr"];

// `satisfies` makes the build fail if French misses a key that English has.
const catalogs = { en, fr: fr satisfies Record<MessageKey, string> } as const;

export function translate(locale: Locale, key: MessageKey): string {
  return catalogs[locale][key];
}

/** Picks the first supported locale from the browser's preferences, else English. */
export function detectLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    const match = LOCALES.find((l) => l === base);
    if (match) return match;
  }
  return "en";
}

export function catalog(locale: Locale): Readonly<Record<MessageKey, string>> {
  return catalogs[locale];
}
