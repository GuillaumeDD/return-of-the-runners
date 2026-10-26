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
| Browser tests | Playwright                             | `e2e/`: replay determinism in Chromium, Firefox and WebKit                                       |
| Lint / format | ESLint (`strictTypeChecked`), Prettier | Lint bans `Math.random`, `innerHTML`, `eval`, `new Function`                                     |
| Runtime       | Node 22 (`.nvmrc`)                     | Dev and CI only; the game has **no runtime dependencies**                                        |

Every new runtime dependency is justified in its PR (CLAUDE.md § Security).

## Module layout

```
index.html ── src/main.ts        entry point: wires DOM, screens, input, loop, rendering
              src/app/           screens by URL hash (`#play`, `#edit`, `#level=…`)
              src/editor/        level editor (step 2)
              src/i18n/          UI strings (en, fr)
              src/sim/           pure, deterministic game simulation
              src/game/loop.ts   fixed-timestep accumulator (real time → whole ticks)
              src/input/         keyboard → per-tick PlayerInput, via a bindings table
              src/render/        Canvas 2D rendering of a simulation state
              src/levels/        bundled levels (JSON, validated at load like any import)
              src/level/         level format: types, validator (migrations from v2 on)
tests/                           Vitest tests, mirroring src/
tests/fixtures/levels/           one fixture set per level format version
tests/fixtures/replays/          committed replays and the result each must reach
e2e/                             Playwright: the replays in real browser engines
```

## Simulation

Code: `src/sim/`. Entry points: `createState(level, seed)` and
`step(state, input) → state`.

- **Pure and deterministic.** Fixed timestep (`TICKS_PER_SECOND = 60`), integer ticks,
  integer positions, seeded PRNG (`prng.ts`, mulberry32, state stored in `GameState`).
  It never touches the DOM, wall-clock time, audio or `Math.random`.
- **Plain-data state** (`state.ts`): no classes or closures, never mutated, so it can be
  hashed (`hash.ts`, FNV-1a over a canonical field order) and compared in tests.
- **Data flow:** input is fed to the simulation as per-tick commands; rendering only
  reads its state. This makes gameplay unit-testable and replayable.
- **Engine-independent:** no transcendental `Math` functions, no reliance on the
  iteration order of objects keyed by numeric-looking strings.
- **Replays** (`replay.ts`): a level, a seed and a run-length encoded input log
  (`[ticks, keys]`, keys in the canonical order `LRUD<>`, `""` for no input) rebuild
  the exact same game. `runReplay` returns the final state and a checkpoint hash every
  simulated second. `parseReplay` validates untrusted replays (known version, capped
  size, ticks and runs; the level goes through the level validator).
- **Determinism evidence** (CLAUDE.md § Determinism): each replay in
  `tests/fixtures/replays/` (`{ about, replay, expected }`) must reach its committed
  tick, status and hash in Node (`tests/sim/replay.test.ts`), and the same checkpoints
  in Chromium, Firefox and WebKit (`e2e/replay.spec.ts`, run in CI). Node and Chromium
  share V8, so Firefox (SpiderMonkey) and WebKit (JavaScriptCore) are the real
  cross-engine evidence. The browsers run a harness (`e2e/harness.html`) built by the
  same Vite pipeline as the game, never deployed.
- **When a replay's hash changes, gameplay changed.** Update `expected` only together
  with an intentional rules change, and say so in the PR (the failing test prints the
  new values).

### Movement model

- Positions are in **sub-units**: one tile is `SUB = 8` sub-units on each axis. An actor
  is aligned on an axis when its position there is a multiple of `SUB`.
- An actor is between two tiles on at most one axis at a time. To change axis (turn
  onto a ladder, step off one), it first **snaps** toward the nearest aligned position.
- **Support** (`physics.ts`): an aligned actor is held up by a ladder or bar in its own
  cell, or by brick, bedrock, a ladder or the level floor below it. Otherwise it falls,
  and input is ignored until it lands or catches a bar.
- **Up** needs a ladder in the current cell; **down** works onto or along a ladder, and
  lets go of a bar. Moving along a bar usually stops between two columns: down then
  snaps the actor onto the nearest column (up to half a tile) and it drops from there. Vertical input wins when it can move; otherwise horizontal applies.
  There is no jump.
- Outside the level reads as bedrock (walls and ceiling); the bottom row stands on the
  level floor.
- Speeds are periods: an actor moves one sub-unit every `RUNNER_PERIOD.*` ticks.

### Digging and holes

- `holes.ts`: a hole is `{ cx, cy, age }`, kept in `GameState.holes` in creation order.
  Its phase comes from its age only: **digging** (still solid), **open**, **closing**
  (both passable), then it is removed and the brick is back (`HOLE_TICKS`).
- `tileAt()` reads an open or closing hole as empty, so movement, falling and support
  need no special case for holes.
- **Digging** (`step.ts`, `tryDig`): exactly one dig key, the runner not falling (on
  the ground, on a ladder or hanging on a bar), the target diagonally below its nearest
  cell an undug brick, and the cell above the target empty or holding gold (a brick,
  ladder or bar blocks; the gold stays in place). Walking or climbing usually stops between two tiles, so the runner snaps onto
  the nearest cell (up to half a tile), turns that way and is busy (frozen) while the
  hole is dug.
- Order within a tick: the runner acts (dig or move), holes age, then a runner whose
  box overlaps a hole that just filled dies. A dead state only counts ticks;
  `game/session.ts` restarts the level `RESTART_DELAY_TICKS` later.
- **All tunable values live in `src/sim/rules.ts`** and are provisional until checked
  against the original (see the table below).

### Gold and exit

- `GameState.goldLeft` counts the gold the runner has not collected yet (later, gold
  carried by monks too). It starts at the number of `$` tiles (`gold.ts`).
- An actor **touches** a cell once its centre is inside it (`centerCell`), so it need
  not be aligned. The runner collects the gold it touches, which removes it from
  `tiles`, also while falling. Gold is neither solid nor support.
- The exit (`E`) is a door: passable, no support, locked while `goldLeft > 0`.
  Touching it once the last gold is taken sets the status to `won`, which freezes the
  state like `dead`, and takes precedence over a hole filling on the same tick.
- Order within a tick: act (dig or move), collect gold, check the exit, age holes,
  check for death. `game/session.ts` restarts the level after a win, since there is
  only one level until packs exist.

### Monks

- `GameState.monks`, created from the `M` markers in reading order, which is also the
  update order. They move with the runner's rules (`move.ts`, shared) at their own,
  slower speed (`MONK_PERIOD`). A monk's body is floor: the runner and other monks can
  stand on it (`physics.ts`, `monkAt`). Monks never overlap: a move into another monk
  is cancelled.
- **Chase AI** (`ai.ts`): the classic 1982 algorithm, reimplemented. Same row and a
  walkable floor between them: go straight at the runner. Otherwise scan the monk's
  floor up to the walls and edges; from each column, see where falling or a ladder
  would lead, and rate it: the runner's row (nearest column first), then above it, then
  below it. The AI reads static tiles, so a hole looks like brick and monks walk into
  it. Like the original, the same-row check ignores walls: a monk on the runner's row
  presses against a wall rather than going around it. A randomized test checks the AI
  against a naive reference implementation.
- **Holes** (`monks.ts`): a monk aligned in an open hole is `trapped` for
  `MONK_TICKS.trapped`, then `escaping`: it climbs to the row above and walks off
  sideways, without falling back in (walled in on both sides, it falls back in). If the hole refills on it, it is `dead` for
  `MONK_TICKS.respawn`, then reappears on the second row from a PRNG-chosen column (the
  first empty cell from there, wrapping, else the next row down).
- **Gold**: a monk with nothing picks up the gold it touches and carries it for
  `MONK_CARRY.min` plus a PRNG draw in `[0, MONK_CARRY.spread)` cells, then drops it on
  the next free floor cell; it waits one cell before picking gold up again. A trapped
  monk drops its gold on top of the hole and waits two cells, so it does not take it
  back while climbing out. Carried gold still counts in `goldLeft`.
- **Catching**: a monk whose centre cell is the runner's catches it (status `dead`). A
  monk standing over a dig target blocks the dig.
- Order within a tick: runner, gold and exit as above, then each monk in order (move,
  gold, trap, catch), then holes age and kill whoever they fill.

## Game loop, input and rendering

- `requestAnimationFrame` drives the loop; `advance()` turns elapsed time into whole
  ticks using integer millionths of a tick (no drift at any refresh rate) and caps a
  frame at 250 ms, so a background tab does not trigger a burst of catch-up ticks.
- Input is sampled once per frame and applied to every tick of that frame. Keys are
  bound by `KeyboardEvent.code` (physical position, so AZERTY works). Held keys are
  cleared on window blur, since a key released while unfocused never fires `keyup`.
- The renderer draws the state with placeholder shapes, `TILE_PX = 24` pixels per tile
  (3 per sub-unit); the canvas is sized to the level and scaled by CSS.
- Bundled levels go through `parseLevel` like any imported level.
- **Screens** (`app/route.ts`): the URL hash picks the screen, so the back button works
  without a server. `#edit` is the editor, `#level=<payload>` a shared level (payloads
  over `MAX_SHARE_PAYLOAD` are never decoded; until B-017 it plays the bundled level),
  anything else is play. The game loop and its key listeners run only while the play
  screen is shown; coming back resumes the same game without catch-up ticks.
- The editor draws the level grid with `renderGrid`: tiles as in the game, start
  markers as the actors, and faint cell lines.
- **Editor model** (`editor/model.ts`): plain data and pure functions, like the
  simulation. `paint` moves the runner start instead of adding a second one;
  `paintLine` fills a segment (Bresenham) so a fast drag leaves no gaps. Undo covers
  the grid only (at most 100 steps); one mouse stroke (`beginStroke` … `endStroke`) is
  one step. `toLevel` runs the edited document through `parseLevel`, so the editor
  never hands the game a level an import would reject.
- **Editor screen** (`editor/view.ts`, the only editor file that touches the DOM): a
  palette (number keys 1–9 by `KeyboardEvent.code`, like the game keys), name and size
  fields, undo and redo. `editor/pointer.ts` maps canvas pixels to cells at any CSS
  scale and turns pointer events into model operations: the left button paints, the
  right one erases, and release, cancel and lost capture all end the stroke, so letting
  go outside the window cannot merge later edits into one undo step. A drag follows
  one pointer: a second finger is ignored. Ctrl+Z / Ctrl+Y go
  by `KeyboardEvent.key`, as in other applications; keys typed in a field are left to
  the field.
- **Test play** (`editor/test-play.ts`): "Test" runs the edited level through the
  validator and, when it passes, plays it in the editor screen with `PLAY_SEED`, the
  play screen's seed (`game/session.ts`); `Esc` or "Back to editor" returns to the editor as it was (the test never
  touches the editor state). A refused test lists the validator's errors, translated
  from their codes (`i18n/level-errors.ts`, a `Record` over every code, so a new code
  without a message fails the build; limits such as the monk cap are filled in from
  `LIMITS`); the list refreshes on every edit until the level is valid.

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
- `.github/workflows/replays.yml` (PRs that touch more than docs, and `main`): runs
  `npm run e2e` in Chromium, Firefox and WebKit. Browsers are cached per Playwright
  version; the job times out after 5 minutes (a normal run takes about one), so a
  hung download fails fast.
- `.github/workflows/deploy.yml` (push to `main`): builds and publishes `dist/` to
  GitHub Pages. Only the deploy job gets `pages: write` and `id-token: write`.
- All actions are pinned to a full commit SHA. Dependabot updates npm weekly and
  actions monthly.

## Observed behavior of the original game

Each entry: the rule or timing, its value, and its provenance (video link +
timestamp, or own playtest). Filled in as gameplay is implemented.

| Behavior                        | Value                              | Provenance                 |
| ------------------------------- | ---------------------------------- | -------------------------- |
| Runner walk / climb / bar speed | 1 tile per 16 ticks (3.75 tiles/s) | **Provisional**, 1982 feel |
| Fall speed                      | 1 tile per 8 ticks (7.5 tiles/s)   | **Provisional**, 1982 feel |
| Hole digging time               | 15 ticks (0.25 s)                  | **Provisional**, 1982 feel |
| Hole stays open                 | 240 ticks (4 s)                    | **Provisional**, 1982 feel |
| Hole refill time                | 30 ticks (0.5 s)                   | **Provisional**, 1982 feel |
| Digging from a ladder or bar    | allowed                            | 1982 rule [^lrtr]          |
| Digging under gold              | allowed, the gold stays in place   | Guillaume's memory of TLR  |
| Gold is collected               | when the runner's centre enters it | **Provisional**            |
| Exit                            | door, opens once all gold is taken | **Provisional**, to check  |
| Monk speed                      | 2/3 of the runner's                | **Provisional**, 1982 feel |
| Monk chase AI                   | classic floor scan (see Monks)     | 1982 rule [^lrtr]          |
| Monk stuck in a hole            | 120 ticks (2 s), then climbs out   | **Provisional**            |
| Monk respawn                    | after 60 ticks, second row, random | 1982 rule [^lrtr]          |
| Monk carries gold               | 12 to 37 cells, then drops it      | 1982 rule [^lrtr]          |
| Caught by a monk                | same centre cell                   | **Provisional**            |

[^lrtr]:
    1982 rules as reimplemented by _Lode Runner Total Recall_, `ok2Dig()` in
    [`lodeRunner.runner.js`](https://github.com/SimonHung/LodeRunner_TotalRecall/blob/master/lodeRunner.runner.js):
    only the target and the cell above it are checked. The monk rules come from
    `lodeRunner.guard.js` in the same project. Still to check against TLR.

## Intentional deviations from the original

| Deviation                                                                                                        | Reason                                                |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| A trapped monk with no room above its hole keeps its gold (1982: it is lost), even if it then dies and reappears | Losing gold would make the level impossible to finish |
