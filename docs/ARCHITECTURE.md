# Architecture

How the game is built. What it must do lives in [`PRD.md`](PRD.md); how we work lives
in [`../CLAUDE.md`](../CLAUDE.md).

## Stack

| Concern       | Choice                                 | Notes                                                                                            |
| ------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Language      | TypeScript (`strict`)                  | Pinned to 6.0.x: `typescript-eslint` 8.x supports TS < 6.1                                       |
| Build / dev   | Vite                                   | `base: "/return-of-the-runners/"` for GitHub Pages                                               |
| Rendering     | Canvas 2D, 640×480 logical resolution  | Scaled with `image-rendering: pixelated`                                                         |
| Audio         | WebAudio                               | (step 4)                                                                                         |
| Unit tests    | Vitest                                 | `tests/**/*.test.ts`; tests have their own `tsconfig` with Node types, which `src/` does not get |
| Browser tests | Playwright                             | (step 1) replay determinism in a real engine                                                     |
| Lint / format | ESLint (`strictTypeChecked`), Prettier | Lint bans `Math.random`, `innerHTML`, `eval`, `new Function`                                     |
| Runtime       | Node 22 (`.nvmrc`)                     | Dev and CI only; the game has **no runtime dependencies**                                        |

Every new runtime dependency is justified in its PR (CLAUDE.md § Security).

## Module layout

```
index.html ── src/main.ts        entry point: wires DOM, input, rendering
              src/i18n/          UI strings (en, fr)
              src/sim/           (step 1) pure, deterministic game simulation
              src/render/        (step 1) Canvas 2D rendering of a simulation state
              src/level/         level format: types, validator (migrations from v2 on)
tests/                           Vitest tests, mirroring src/
tests/fixtures/levels/           one fixture set per level format version
```

## Simulation

- **Pure and deterministic.** Fixed timestep, integer ticks, integer grid
  coordinates, seeded PRNG. It never touches the DOM, wall-clock time, audio or
  `Math.random`.
- **Data flow:** input is fed to the simulation as per-tick commands; rendering only
  reads its state. This makes gameplay unit-testable and replayable.
- **Engine-independent:** no transcendental `Math` functions, no reliance on the
  iteration order of objects keyed by numeric-looking strings.
- **Replays:** a recorded input log must replay to the same state hash in Node and in
  a headless browser (BACKLOG B-010).

## Level format

Code: `src/level/format.ts` (types, tile alphabet, limits) and `src/level/parse.ts`
(`parseLevel(text)`: validates untrusted input and never throws; errors are values with
a stable `code`, translated in the UI).

### Version 1

```json
{
  "format": "return-of-the-runners/level",
  "version": 1,
  "name": "First steps",
  "width": 28,
  "height": 16,
  "grid": ["............................", "..."]
}
```

All six fields are required; any other field is rejected. `grid` has `height` rows of
exactly `width` tiles, top row first.

| Char | Tile                                   |
| ---- | -------------------------------------- |
| `.`  | empty                                  |
| `#`  | brick (diggable)                       |
| `@`  | bedrock (not diggable)                 |
| `H`  | ladder                                 |
| `-`  | bar (hand-over-hand)                   |
| `$`  | gold                                   |
| `E`  | exit (locked until all gold collected) |
| `P`  | runner start                           |
| `M`  | monk start                             |

| Rule              | Limit                                   | Error code                                |
| ----------------- | --------------------------------------- | ----------------------------------------- |
| Input size        | ≤ 64 KB (UTF-8 bytes)                   | `too-large`                               |
| `format`          | exactly `"return-of-the-runners/level"` | `wrong-format`                            |
| `version`         | the number `1`                          | `unsupported-version`                     |
| Fields            | exactly the six above                   | `missing-field`, `unknown-field`          |
| `name`            | 1–64 code points, not blank             | `invalid-name`                            |
| `width`, `height` | integers, 8–64 and 8–48                 | `invalid-dimension`                       |
| `grid`            | array of strings, right shape           | `invalid-grid`, `row-count`, `row-length` |
| Tiles             | only the characters above               | `unknown-tile`                            |
| Runner            | exactly one `P`                         | `runner-count`                            |
| Gold, exit        | at least one `$` and one `E`            | `no-gold`, `no-exit`                      |
| Monks             | at most 16 `M`                          | `too-many-monks`                          |

Structural errors (size, JSON, format, version) stop validation; all other errors are
reported together. The TLR grid size is not yet confirmed (see `plans/step-1.md`), which
is why width and height are per-level properties.

### Versioning

- Every format change bumps `version` and ships a migration from the previous version.
- Every version keeps fixture files in `tests/fixtures/levels/v<N>/` (`valid/` and
  `invalid/`; an invalid fixture is named after its expected error code, with an
  optional `--variant` suffix). Fixtures are excluded from Prettier so they stay
  byte-for-byte as written.
- Editor levels are stored in the browser (IndexedDB/localStorage) and can always be
  exported/imported as files.

## Internationalization

- Catalogs: `src/i18n/en.json` (reference) and `src/i18n/fr.json`.
- `fr.json` is type-checked against the English keys (`satisfies`), so a missing key
  fails the build; a test also checks identical key sets and no empty strings.
- Locale is detected from `navigator.languages`, defaulting to English, and can be
  switched in the UI.

## Security

The game is a static site with no backend; the attack surface is untrusted level
data and the supply chain.

- **Untrusted input at the boundary:** level files and share links go through a
  strict validator (known versions only, capped grid size, string lengths and
  decompressed size) before reaching the simulation. The parser is fuzzed.
- **DOM:** level data is only ever rendered with `textContent` or on the canvas.
- **Content Security Policy** (meta tag in `index.html`): `default-src 'self'`,
  same-origin scripts and styles only, no inline code, no `eval`, `object-src 'none'`.

## Build, CI and deploy

- `.github/workflows/ci.yml` (PRs and `main`): `npm ci`, typecheck, lint, test,
  build, `npm audit --omit=dev`; a separate job runs gitleaks over the full history.
- `.github/workflows/deploy.yml` (push to `main`): builds and publishes `dist/` to
  GitHub Pages. Only the deploy job gets `pages: write` and `id-token: write`.
- All actions are pinned to a full commit SHA. Dependabot updates npm weekly and
  actions monthly.

## Observed behavior of the original game

Each entry: the rule or timing, its value, and its provenance (video link +
timestamp, or own playtest). Filled in as gameplay is implemented.

| Behavior     | Value | Provenance |
| ------------ | ----- | ---------- |
| _(none yet)_ |       |            |

## Intentional deviations from the original

| Deviation    | Reason |
| ------------ | ------ |
| _(none yet)_ |        |
