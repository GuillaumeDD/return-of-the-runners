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
  type Teleport,
} from "./format";

const REQUIRED = ["format", "version", "name", "width", "height", "grid"] as const;
const OPTIONAL = ["teleports"] as const;
const KNOWN_FIELDS: ReadonlySet<string> = new Set([...REQUIRED, ...OPTIONAL]);

const utf8 = new TextEncoder();

export interface ParseOptions {
  /** False checks only the level's shape, for drafts (see `LevelDraft`). Default true. */
  readonly gameRules?: boolean;
}

type Add = (code: LevelErrorCode, detail: string) => void;

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

  const { errors, teleports } = validate(obj, gameRules);
  if (errors.length > 0) return { ok: false, errors };

  const level: Level = {
    version: LEVEL_FORMAT_VERSION,
    name: obj.name as string,
    width: obj.width as number,
    height: obj.height as number,
    grid: [...(obj.grid as string[])],
    teleports,
  };
  return { ok: true, level };
}

/** Every content error of a document. */
function validate(
  obj: Record<string, unknown>,
  gameRules: boolean,
): { readonly errors: LevelError[]; readonly teleports: Teleport[] } {
  const errors: LevelError[] = [];
  const add: Add = (code, detail) => {
    errors.push({ code, detail });
  };

  for (const key of Object.keys(obj)) {
    if (!KNOWN_FIELDS.has(key)) add("unknown-field", `unknown field "${truncate(key)}"`);
  }
  for (const key of REQUIRED) {
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

  let cells: string[][] | null = null;
  if (Object.hasOwn(obj, "grid")) {
    if (!Array.isArray(grid) || !grid.every((row): row is string => typeof row === "string")) {
      add("invalid-grid", `"grid" must be an array of strings`);
    } else {
      cells = checkGrid(
        grid,
        widthOk ? (width as number) : null,
        heightOk ? (height as number) : null,
        gameRules,
        add,
      );
    }
  }

  const links = Object.hasOwn(obj, "teleports") ? readTeleports(obj.teleports) : [];
  if (links === null) {
    add("invalid-teleports", `"teleports" must be an array of [fromX, fromY, toX, toY] integers`);
  } else if (gameRules && cells !== null) {
    // Links are checked against a well-formed grid only: a broken grid is reported already.
    checkTeleports(links, cells, add);
    checkUnlinked(links, cells, add);
  }

  return { errors, teleports: links ?? [] };
}

function checkDimension(
  obj: Record<string, unknown>,
  key: "width" | "height",
  value: unknown,
  min: number,
  max: number,
  add: Add,
): boolean {
  if (!Object.hasOwn(obj, key)) return false;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    add("invalid-dimension", `"${key}" must be an integer from ${String(min)} to ${String(max)}`);
    return false;
  }
  return true;
}

/**
 * Checks the grid's rows and tiles, and the tile counts when `gameRules` is set. Returns
 * the cells (`cells[y][x]`) when the grid is well-formed (right size, known tiles), so
 * the teleporter links can be checked against it; null otherwise.
 */
function checkGrid(
  grid: readonly string[],
  width: number | null,
  height: number | null,
  gameRules: boolean,
  add: Add,
): string[][] | null {
  let wellFormed = width !== null && height !== null;
  if (height !== null && grid.length !== height) {
    add("row-count", `"grid" has ${String(grid.length)} rows, expected ${String(height)}`);
    wellFormed = false;
  }

  const counts = new Map<string, number>();
  const unknown = new Set<string>();
  const cells = grid.map((row, y) => {
    const rowCells = codePoints(row);
    if (width !== null && rowCells.length !== width) {
      add(
        "row-length",
        `row ${String(y)} has ${String(rowCells.length)} tiles, expected ${String(width)}`,
      );
      wellFormed = false;
    }
    for (const c of rowCells) {
      if (TILE_CHARS.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
      else unknown.add(c);
    }
    return rowCells;
  });

  if (unknown.size > 0) {
    const shown = [...unknown]
      .slice(0, 8)
      .map((c) => JSON.stringify(c))
      .join(", ");
    add("unknown-tile", `unknown tile characters: ${shown}`);
    wellFormed = false;
  }
  if (gameRules) {
    const runners = counts.get(TILE.runnerStart) ?? 0;
    if (runners !== 1) add("runner-count", `expected exactly 1 "P", found ${String(runners)}`);
    const players2 = counts.get(TILE.player2Start) ?? 0;
    if (players2 > 1) add("player2-count", `expected at most 1 "Q", found ${String(players2)}`);
    if ((counts.get(TILE.gold) ?? 0) === 0) add("no-gold", `level needs at least one "$"`);
    if ((counts.get(TILE.exit) ?? 0) === 0) add("no-exit", `level needs at least one "E"`);
    const monks = counts.get(TILE.monkStart) ?? 0;
    if (monks > LIMITS.maxMonks) {
      add("too-many-monks", `${String(monks)} "M" found, at most ${String(LIMITS.maxMonks)}`);
    }
  }
  return wellFormed ? cells : null;
}

/** The links of a `teleports` value, or null when it does not have their shape. */
function readTeleports(value: unknown): Teleport[] | null {
  if (!Array.isArray(value)) return null;
  const links: Teleport[] = [];
  for (const link of value as unknown[]) {
    if (!Array.isArray(link) || link.length !== 4) return null;
    const [a, b, c, d] = link as unknown[];
    if (!isInt(a) || !isInt(b) || !isInt(c) || !isInt(d)) return null;
    links.push([a, b, c, d]);
  }
  return links;
}

/**
 * Each link goes from an entrance (`T`) to an exit (`t`), both inside the grid, and no
 * entrance has two links. Each problem is reported once, with its first occurrence.
 */
function checkTeleports(links: readonly Teleport[], cells: readonly string[][], add: Add): void {
  const reported = new Set<LevelErrorCode>();
  const once = (code: LevelErrorCode, detail: string): void => {
    if (reported.has(code)) return;
    reported.add(code);
    add(code, detail);
  };
  const linked = new Set<string>();
  links.forEach(([fx, fy, tx, ty], i) => {
    const at = `link ${String(i)} [${[fx, fy, tx, ty].map(String).join(", ")}]`;
    const from = cells[fy]?.[fx];
    const to = cells[ty]?.[tx];
    if (from === undefined || to === undefined) {
      once("teleport-out-of-grid", `${at} leaves the grid`);
      return;
    }
    if (from !== TILE.teleportEntrance) once("teleport-not-entrance", `${at} starts on "${from}"`);
    if (to !== TILE.teleportExit) once("teleport-not-exit", `${at} ends on "${to}"`);
    const key = `${String(fx)},${String(fy)}`;
    if (linked.has(key)) once("teleport-duplicate", `${at}: the entrance has another link`);
    linked.add(key);
  });
}

/** Every entrance (`T`) has a link. */
function checkUnlinked(links: readonly Teleport[], cells: readonly string[][], add: Add): void {
  const linked = new Set(links.map(([fx, fy]) => `${String(fx)},${String(fy)}`));
  for (let y = 0; y < cells.length; y++) {
    const row = cells[y] ?? [];
    for (let x = 0; x < row.length; x++) {
      if (row[x] === TILE.teleportEntrance && !linked.has(`${String(x)},${String(y)}`)) {
        add("teleport-unlinked", `the entrance at ${String(x)}, ${String(y)} has no link`);
        return;
      }
    }
  }
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v);
}

function fail(code: LevelErrorCode, detail: string): ParseResult {
  return { ok: false, errors: [{ code, detail }] };
}

function truncate(s: string): string {
  return s.length > 32 ? `${s.slice(0, 32)}…` : s;
}
