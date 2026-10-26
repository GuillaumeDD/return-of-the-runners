import { LIMITS, type LevelErrorCode } from "../level/format";
import { translate, type Locale, type MessageKey } from ".";

/**
 * The translated message for each level error code. A `Record`, so adding a code to the
 * validator without a message fails the build.
 */
export const LEVEL_ERROR_MESSAGE: Readonly<Record<LevelErrorCode, MessageKey>> = {
  "too-large": "errTooLarge",
  "not-json": "errNotJson",
  "not-object": "errNotObject",
  "wrong-format": "errWrongFormat",
  "unsupported-version": "errUnsupportedVersion",
  "missing-field": "errMissingField",
  "unknown-field": "errUnknownField",
  "invalid-name": "errInvalidName",
  "invalid-dimension": "errInvalidDimension",
  "invalid-grid": "errInvalidGrid",
  "row-count": "errRowCount",
  "row-length": "errRowLength",
  "unknown-tile": "errUnknownTile",
  "runner-count": "errRunnerCount",
  "no-gold": "errNoGold",
  "no-exit": "errNoExit",
  "too-many-monks": "errTooManyMonks",
  "unreadable-file": "errUnreadableFile",
  "too-long": "errTooLong",
  "not-base64": "errNotBase64",
  "not-deflate": "errNotDeflate",
};

/**
 * The message for an error code, with the format's limits filled in ({maxName},
 * {minWidth}…), so the messages cannot drift from the validator.
 */
export function levelErrorMessage(locale: Locale, code: LevelErrorCode): string {
  return translate(locale, LEVEL_ERROR_MESSAGE[code])
    .replaceAll("{maxName}", String(LIMITS.maxNameLength))
    .replaceAll("{minWidth}", String(LIMITS.minWidth))
    .replaceAll("{maxWidth}", String(LIMITS.maxWidth))
    .replaceAll("{minHeight}", String(LIMITS.minHeight))
    .replaceAll("{maxHeight}", String(LIMITS.maxHeight))
    .replaceAll("{maxMonks}", String(LIMITS.maxMonks));
}

/** The distinct error codes of a refused level, in order: what the UI lists. */
export function uniqueCodes(
  errors: readonly { readonly code: LevelErrorCode }[],
): LevelErrorCode[] {
  return [...new Set(errors.map((e) => e.code))];
}
