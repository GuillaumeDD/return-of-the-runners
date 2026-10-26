import { translate, type Locale } from "../i18n";

/**
 * Reads a size field: a whole number, or NaN for anything else (an empty field, a
 * sign, a decimal), which `resize` treats as "keep the current size". `Number("")` is 0,
 * which would crop the level to the minimum size.
 */
export function parseSize(text: string): number {
  return /^\s*\d{1,4}\s*$/.test(text) ? Number(text) : Number.NaN;
}

/**
 * The level name after a language switch: the default name follows the language, a
 * name the maker typed stays as it is.
 */
export function relabelName(name: string, from: Locale, to: Locale): string {
  return name === translate(from, "defaultLevelName") ? translate(to, "defaultLevelName") : name;
}
