import { LEVEL_FORMAT_VERSION, type LevelError } from "./format";

export type Migration =
  | { readonly ok: true; readonly doc: Record<string, unknown> }
  | { readonly ok: false; readonly error: LevelError };

/**
 * The v2 document of a v1 document: the same name, size and grid (every v1 tile means
 * the same in v2), with no teleporters. Pure; it does not validate the document, so
 * `parseLevel` checks it against the v1 rules first. Anything but a v1 document is
 * refused, so a document is never migrated twice.
 */
export function migrateV1(doc: Readonly<Record<string, unknown>>): Migration {
  if (doc.version !== 1) {
    return {
      ok: false,
      error: { code: "unsupported-version", detail: `"version" must be 1 to migrate from v1` },
    };
  }
  return {
    ok: true,
    doc: {
      format: doc.format,
      version: LEVEL_FORMAT_VERSION,
      name: doc.name,
      width: doc.width,
      height: doc.height,
      grid: doc.grid,
    },
  };
}
