import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../fixtures/levels");

/** The format versions that keep fixtures, oldest first. */
export const FIXTURE_VERSIONS = ["v2", "v3"] as const;
export type FixtureVersion = (typeof FIXTURE_VERSIONS)[number];

export interface Fixture {
  /** The file name, prefixed with its version folder (`v2/minimal-8x8.json`). */
  readonly file: string;
  readonly text: string;
  /** For invalid fixtures: the error code, taken from the file name before `--`. */
  readonly expectedCode: string;
}

/** The fixtures of one version, or of every version when none is given. */
export function loadFixtures(kind: "valid" | "invalid", version?: FixtureVersion): Fixture[] {
  const versions = version === undefined ? FIXTURE_VERSIONS : [version];
  return versions.flatMap((v) => {
    const dir = join(ROOT, v, kind);
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((file) => ({
        file: `${v}/${file}`,
        text: readFileSync(join(dir, file), "utf8"),
        expectedCode: file.replace(/\.json$/, "").split("--")[0] ?? "",
      }));
  });
}
