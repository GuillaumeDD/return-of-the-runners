import {
  LEVEL_FORMAT_ID,
  LEVEL_FORMAT_VERSION,
  LIMITS,
  TILE,
  TILE_CHARS,
  codePoints,
  type Level,
  type LevelError,
  type LevelErrorCode,
  type ParseResult,
} from "./format";

const FIELDS = ["format", "version", "name", "width", "height", "grid"] as const;
const KNOWN_FIELDS: ReadonlySet<string> = new Set(FIELDS);

const utf8 = new TextEncoder();

export interface ParseOptions {
  /** False checks only the level's shape, for drafts (see `LevelDraft`). Default true. */
  readonly gameRules?: boolean;
}

/**
 * Parses and validates an untrusted level document. Never throws: every problem is
 * returned as a `LevelError`. Structural problems (size, JSON, format, version) stop
 * validation early; content problems are all reported together.
 */
export function parseLevel(text: string, options: ParseOptions = {}): ParseResult {
  const gameRules = options.gameRules ?? true;
  // Cheap pre-check on string length (UTF-16 units ≤ UTF-8 bytes) before encoding.
  if (text.length > LIMITS.maxInputBytes || utf8.encode(text).length > LIMITS.maxInputBytes) {
    return fail("too-large", `input exceeds ${String(LIMITS.maxInputBytes)} bytes`);
  }

  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return fail("not-json", "input is not valid JSON");
  }
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    return fail("not-object", "top level must be a JSON object");
  }
  const obj = doc as Record<string, unknown>;

  if (!Object.hasOwn(obj, "format") || obj.format !== LEVEL_FORMAT_ID) {
    return fail("wrong-format", `"format" must be "${LEVEL_FORMAT_ID}"`);
  }
  if (!Object.hasOwn(obj, "version") || obj.version !== LEVEL_FORMAT_VERSION) {
    return fail("unsupported-version", `"version" must be ${String(LEVEL_FORMAT_VERSION)}`);
  }

  const errors: LevelError[] = [];
  const add = (code: LevelErrorCode, detail: string): void => {
    errors.push({ code, detail });
  };

  for (const key of Object.keys(obj)) {
    if (!KNOWN_FIELDS.has(key)) add("unknown-field", `unknown field "${truncate(key)}"`);
  }
  for (const key of FIELDS) {
    if (!Object.hasOwn(obj, key)) add("missing-field", `missing field "${key}"`);
  }

  const { name, width, height, grid } = obj;

  if (Object.hasOwn(obj, "name")) {
    if (
      typeof name !== "string" ||
      name.trim().length === 0 ||
      codePoints(name).length > LIMITS.maxNameLength
    ) {
      add("invalid-name", `"name" must be 1 to ${String(LIMITS.maxNameLength)} characters`);
    }
  }

  const widthOk = checkDimension(obj, "width", width, LIMITS.minWidth, LIMITS.maxWidth, add);
  const heightOk = checkDimension(obj, "height", height, LIMITS.minHeight, LIMITS.maxHeight, add);

  if (Object.hasOwn(obj, "grid")) {
    if (!Array.isArray(grid) || !grid.every((row): row is string => typeof row === "string")) {
      add("invalid-grid", `"grid" must be an array of strings`);
    } else {
      checkGrid(
        grid,
        widthOk ? (width as number) : null,
        heightOk ? (height as number) : null,
        gameRules,
        add,
      );
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const level: Level = {
    version: LEVEL_FORMAT_VERSION,
    name: name as string,
    width: width as number,
    height: height as number,
    grid: [...(grid as string[])],
  };
  return { ok: true, level };
}

function checkDimension(
  obj: Record<string, unknown>,
  key: "width" | "height",
  value: unknown,
  min: number,
  max: number,
  add: (code: LevelErrorCode, detail: string) => void,
): boolean {
  if (!Object.hasOwn(obj, key)) return false;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    add("invalid-dimension", `"${key}" must be an integer from ${String(min)} to ${String(max)}`);
    return false;
  }
  return true;
}

function checkGrid(
  grid: readonly string[],
  width: number | null,
  height: number | null,
  gameRules: boolean,
  add: (code: LevelErrorCode, detail: string) => void,
): void {
  if (height !== null && grid.length !== height) {
    add("row-count", `"grid" has ${String(grid.length)} rows, expected ${String(height)}`);
  }

  const counts = new Map<string, number>();
  const unknown = new Set<string>();
  grid.forEach((row, y) => {
    const cells = codePoints(row);
    if (width !== null && cells.length !== width) {
      add(
        "row-length",
        `row ${String(y)} has ${String(cells.length)} tiles, expected ${String(width)}`,
      );
    }
    for (const c of cells) {
      if (TILE_CHARS.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
      else unknown.add(c);
    }
  });

  if (unknown.size > 0) {
    const shown = [...unknown]
      .slice(0, 8)
      .map((c) => JSON.stringify(c))
      .join(", ");
    add("unknown-tile", `unknown tile characters: ${shown}`);
  }
  if (!gameRules) return;
  const runners = counts.get(TILE.runnerStart) ?? 0;
  if (runners !== 1) add("runner-count", `expected exactly 1 "P", found ${String(runners)}`);
  if ((counts.get(TILE.gold) ?? 0) === 0) add("no-gold", `level needs at least one "$"`);
  if ((counts.get(TILE.exit) ?? 0) === 0) add("no-exit", `level needs at least one "E"`);
  const monks = counts.get(TILE.monkStart) ?? 0;
  if (monks > LIMITS.maxMonks) {
    add("too-many-monks", `${String(monks)} "M" found, at most ${String(LIMITS.maxMonks)}`);
  }
}

function fail(code: LevelErrorCode, detail: string): ParseResult {
  return { ok: false, errors: [{ code, detail }] };
}

function truncate(s: string): string {
  return s.length > 32 ? `${s.slice(0, 32)}…` : s;
}
