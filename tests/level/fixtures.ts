import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../fixtures/levels/v1");

export interface Fixture {
  readonly file: string;
  readonly text: string;
  /** For invalid fixtures: the error code, taken from the file name before `--`. */
  readonly expectedCode: string;
}

export function loadFixtures(kind: "valid" | "invalid"): Fixture[] {
  const dir = join(ROOT, kind);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => ({
      file,
      text: readFileSync(join(dir, file), "utf8"),
      expectedCode: file.replace(/\.json$/, "").split("--")[0] ?? "",
    }));
}
