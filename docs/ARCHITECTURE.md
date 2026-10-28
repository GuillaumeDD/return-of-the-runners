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
| Browser tests | Playwright                             | `e2e/`: replay determinism and share links in Chromium, Firefox and WebKit                       |
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
              src/level/         level format: types, validator (migrations from v3 on)
              src/storage/       "My levels" in the browser (localStorage, validated)
              src/share/         share links: a level in the URL fragment
tests/                           Vitest tests, mirroring src/
tests/fixtures/levels/           one fixture set per level format version
tests/fixtures/replays/          committed replays and the result each must reach
e2e/                             Playwright: replays and share links in real browser engines
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
  same Vite pipeline as the game, never deployed. `e2e/share.spec.ts` checks share
  links both ways (made in Node, opened in each browser, and the reverse) with
  `e2e/share.html`, since each engine brings its own `CompressionStream`.
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
  sideways, without falling back in (walled in on both sides, it falls back in). It
  cannot climb while the runner stands in the cell above the hole (S-100). If the hole refills on it, it is `dead` for
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
  without a server. `#edit` is the editor, `#level=<payload>` a shared level (of any
  length: the decoder refuses one over `MAX_SHARE_PAYLOAD` with a message),
  anything else is play. The game loop and its key listeners run only while the play
  screen is shown; coming back resumes the same game without catch-up ticks.

## Level format

Code: `src/level/format.ts` (types, tile alphabet, limits) and `src/level/parse.ts`
(`parseLevel(text)`: validates untrusted input and never throws; errors are values with
a stable `code`, translated in the UI).

### Version 2

The current and only version, since B-019. Version 1 (the same document without
`teleports`, and only the nine tiles of the left column below) is **no longer read**:
it is refused as `unsupported-version`. This is a one-time exception to the migration
rule, decided by Guillaume on 2026-10-28 because no player had used v1 yet; it avoids
carrying a migration for nobody. A v1 level stored in the browser is skipped as a
damaged entry, and kept as it is.

```json
{
  "format": "return-of-the-runners/level",
  "version": 2,
  "name": "First steps",
  "width": 28,
  "height": 16,
  "grid": ["............................", "..."],
  "teleports": [[2, 3, 8, 3]]
}
```

The first six fields are required; `teleports` is optional (written only when the
level has a teleporter); any other field is rejected. `grid` has `height` rows of
exactly `width` tiles, top row first. Each `teleports` entry is a one-way link
`[fromX, fromY, toX, toY]`, in cells, from an entrance `T` to an exit `t`: one grid
cell cannot hold a link, so links live beside the grid.

| Char | Tile                                   | Char        | Tile                       |
| ---- | -------------------------------------- | ----------- | -------------------------- |
| `.`  | empty                                  | `Q`         | player 2 start             |
| `#`  | brick (diggable)                       | `%`         | trapdoor turf (fake brick) |
| `@`  | bedrock (not diggable)                 | `~`         | gooey turf                 |
| `H`  | ladder                                 | `h`         | hidden ladder              |
| `-`  | bar (hand-over-hand)                   | `R`         | monk respawn point         |
| `$`  | gold                                   | `n`         | alcove (hiding place)      |
| `E`  | exit (locked until all gold collected) | `T`         | teleporter entrance        |
| `P`  | runner start (player 1)                | `t`         | teleporter exit            |
| `M`  | monk start                             | `a` `b` `c` | key: red, green, blue      |
|      |                                        | `A` `B` `C` | door: red, green, blue     |
|      |                                        | `j`         | jackhammer                 |
|      |                                        | `k`         | pickaxe                    |
|      |                                        | `o`         | small bomb                 |
|      |                                        | `O`         | big bomb                   |
|      |                                        | `s`         | snare                      |
|      |                                        | `g`         | gas spray                  |
|      |                                        | `u`         | goo bucket                 |

The left column holds the tiles of the 1982 game (`TILE_BASE`). The right column is reserved by the format first: each
tile gets its behavior, its drawing and its place in the editor palette with its own
step 3 item (B-020 to B-028, see [`plans/step-3.md`](plans/step-3.md)). Until then the
game does not draw it, and it is neither solid nor climbable: nothing in the editor
palette places one, but an imported v2 file may hold some.

| Rule              | Limit                                                             | Error code                                  |
| ----------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| Input size        | ≤ 64 KB (UTF-8 bytes)                                             | `too-large`                                 |
| `format`          | exactly `"return-of-the-runners/level"`                           | `wrong-format`                              |
| `version`         | the number `1` or `2`                                             | `unsupported-version`                       |
| Fields            | the six above, plus `teleports` in v2                             | `missing-field`, `unknown-field`            |
| `name`            | 1–64 code points, not blank                                       | `invalid-name`                              |
| `width`, `height` | integers, 8–64 and 8–48                                           | `invalid-dimension`                         |
| `grid`            | array of strings, right shape                                     | `invalid-grid`, `row-count`, `row-length`   |
| Tiles             | only the characters of the document's version                     | `unknown-tile`                              |
| `teleports`       | array of 4-integer arrays                                         | `invalid-teleports`                         |
| Runner            | exactly one `P`                                                   | `runner-count` ★                            |
| Player 2          | at most one `Q`                                                   | `player2-count` ★                           |
| Gold, exit        | at least one `$` and one `E`                                      | `no-gold`, `no-exit` ★                      |
| Monks             | at most 16 `M`                                                    | `too-many-monks` ★                          |
| Link ends         | both inside the grid                                              | `teleport-out-of-grid` ★                    |
| Link start        | on an entrance `T`                                                | `teleport-not-entrance` ★                   |
| Link end          | on an exit `t`                                                    | `teleport-not-exit` ★                       |
| Entrances         | each `T` has exactly one link (an exit may have several, or none) | `teleport-duplicate`, `teleport-unlinked` ★ |

★ Game rules: not checked for drafts (`parseLevel(text, { gameRules: false })`), so a
level being built can be saved with a dangling link or a missing exit. Links are
checked only against a well-formed grid (a broken grid is reported already), and each
link problem is reported once. Keys and doors may exist without each other: the maker
tests the level.

Structural errors (size, JSON, format, version) stop validation; all other errors are
reported together. TLR levels are 28 × 16 (S-001, S-015); width and height stay per-level
properties so makers can build other sizes.

### Versioning

- Every format change bumps `version` and ships a migration from the previous version
  (exception: v1 → v2, see above).
- Every version keeps fixture files in `tests/fixtures/levels/v<N>/` (`valid/` and
  `invalid/`; an invalid fixture is named after its expected error code, with an
  optional `--variant` suffix). Fixtures are excluded from Prettier so they stay
  byte-for-byte as written.

## Editor

Code: `src/editor/` (pure modules, and `view.ts` / `library-view.ts` for the DOM),
`src/storage/levels.ts`, `src/level/file.ts`, `src/share/link.ts`.

- **Grid**: the editor draws the level grid with `renderGrid`: tiles as in the game, start
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
- Editor levels are stored in the browser (`storage/levels.ts`): one `localStorage` key,
  `rotr.levels.v1`, holding a versioned document (`return-of-the-runners/my-levels`)
  with an id counter and the levels as v2 documents. They are **drafts**
  (`LevelDraft`, parsed with `parseLevel(text, { gameRules: false })`): the shape is
  checked, the game rules are not, so a level can be saved half-built. A draft has no
  `version` field, so the type system refuses to play one without a full `parseLevel`.
  Everything read back is untrusted: a broken entry is skipped, reported and kept as it
  is in later rewrites (never erased), an
  unreadable document gives an empty list and is copied to `rotr.levels.v1.corrupt`
  before the next save replaces it; storage errors (quota, disabled) are returned, never
  thrown.
- Levels are exported and imported as files (`level/file.ts`): `<name>.rotr.json`, the
  exact v2 document, pretty-printed (one grid row and one teleporter link per line).
  Export needs a playable level. An import is
  untrusted input: over 64 KB it is rejected from `File.size` before a byte is read,
  then it goes through `parseLevel` with the game rules; a read failure is the
  `unreadable-file` error. The file name is plain ASCII (headless Chromium names a
  non-ASCII `download` "download"), and Windows device names get a `-level` suffix. A
  slow read is dropped if the editor changed or another import started meanwhile.
- **Share links** (`share/link.ts`): `#level=<payload>`, where the payload is the
  level's compact v2 JSON, compressed with raw DEFLATE (`CompressionStream`, built
  into the browsers and Node, so no dependency) and written in base64url. The fragment
  never reaches a server. Decoding is untrusted input, capped at each step: at most
  `MAX_SHARE_PAYLOAD` (16 K) characters, canonical base64url (spare bits must be zero),
  and the inflated output is read until it passes 64 KB, then dropped (`too-large`);
  the input is fed in 256-byte slices, and DEFLATE expands at most ~1,032:1, so a "zip
  bomb" costs at most ~12 MB of work. Then `parseLevel` with the game rules. The
  bundled level is a 266-character payload; the largest level fits well under the cap.
- "Share" needs a playable level. It copies the link and also shows it in a read-only
  field, since the clipboard can be refused. A link opens on the play screen; "Edit a
  copy" saves it as a new level in "My levels" and opens it, unless the editor has
  unsaved changes, which are kept (the copy then waits in the list). If the browser
  refuses to store the copy while the editor has unsaved changes, the link stays on
  screen with a message.

### Conventions

- **Async UI results**: a result that arrives later (a file read, a compression, a
  clipboard write, a decoded link) is applied only if its ticket is the latest one and
  the state it started from is unchanged; otherwise it is dropped.
- **Untrusted text**: shown with `textContent` or set as an input `value`. A message
  placeholder is filled with a function, `replace("{name}", () => name)`, since a
  replacement string would expand patterns such as `$&` from a level name.

### Browser quirks

Each cost a debugging round in step 2; check here before relying on a web API.
"Measured" says where it was seen; the others are known rules not yet run here (the
e2e UI tests of B-018 will run them in all three engines).

| Quirk                                                                   | Measured                | Where it bites                                                   |
| ----------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------- |
| A non-ASCII `download` file name becomes "download"                     | headless Chromium       | Export: file names are made ASCII                                |
| Node's `DecompressionStream` reads all input regardless of backpressure | Node 22                 | Share: a zip bomb is bounded by the payload cap, not the slicing |
| Clipboard writes are allowed only during the user gesture               | no (Safari, documented) | Share: the write starts in the click, with a promise of the link |
| Reading `window.localStorage` throws when site data is blocked          | no (documented)         | My levels: `browserStorage()` in `main.ts`                       |
| A click on a link that is not in the document starts no download        | no (older Firefox)      | Export: the link is appended, clicked, then removed              |

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
- **Clean-room check** of a release (CLAUDE.md § Privacy, secrets & publishing): open
  the deployed site, or, when it cannot be reached (a cloud session whose network
  policy does not allow `guillaumedd.github.io`), a fresh clone of `main` with
  `npm ci && npm run build` and `vite preview`, driven by Playwright. The PR or reply
  says which one was checked.

## Observed behavior of the original game

Each entry: the rule or timing, its value, and its provenance (a source id from
[`SOURCES.md`](SOURCES.md), with a timestamp for a video, or own playtest). Filled in
as gameplay is implemented.

| Behavior                        | Value                                                                                     | Provenance                 |
| ------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------- |
| Level grid                      | 28 × 16 tiles                                                                             | S-001, S-015 @ 0:30        |
| Runner walk / climb / bar speed | 1 tile per 16 ticks (3.75 tiles/s)                                                        | **Provisional**, 1982 feel |
| Fall speed                      | 1 tile per 8 ticks (7.5 tiles/s)                                                          | **Provisional**, 1982 feel |
| Hole digging time               | 15 ticks (0.25 s)                                                                         | **Provisional**, 1982 feel |
| Hole stays open                 | 240 ticks (4 s)                                                                           | **Provisional**, 1982 feel |
| Hole refill time                | 30 ticks (0.5 s)                                                                          | **Provisional**, 1982 feel |
| Digging from a ladder or bar    | allowed                                                                                   | 1982 rule [^lrtr]          |
| Digging under gold              | allowed, the gold stays in place                                                          | S-100 (Guillaume's memory) |
| Gold is collected               | when the runner's centre enters it                                                        | **Provisional**            |
| Exit                            | door, opens once all gold is taken                                                        | **Provisional**, to check  |
| Exit in TLR                     | absent until the last gold is taken, then appears (B-024)                                 | S-015 @ 1:22               |
| Keys                            | carried in the item slot to the door of their colour                                      | S-016 @ 3:03–3:33          |
| Bombs                           | collected into a counter, fuse ≈ 2.5 s, chain reactions, blasted blocks back after ≈ 13 s | S-015 @ 1:05–1:24          |
| Jackhammer                      | rides straight down through brick, ≈ 5 tiles in 9 s; tool kept                            | S-019 @ 2:33–2:43          |
| Gas gun                         | cloud ≈ 2 tiles for ≈ 6 s; monks inside stuck; gun kept                                   | S-021 @ 0:54–1:04          |
| Two-player race                 | mirrored halves, exits appear with the gold, first out wins                               | S-025                      |
| Co-op end                       | won when one player exits; a dead player alone restarts, on their own lives               | S-100 (2026-10-27)         |
| Pickaxe                         | rubble buries the monk on the next cell; ≥ 7 s; tool kept                                 | S-021 @ 0:08–0:15.5        |
| Goo bucket                      | goo 2–3 cells in front, rest of the level; one use; stops monks                           | S-022 @ 3:16, @ 3:36       |
| Teleporter                      | step in, reappear at the linked spot ≈ 0.5–1 s later                                      | S-025 @ 0:04–0:05          |
| Big bomb                        | same counter; round blast ≈ 5 cells, permanent; chain reactions                           | S-025 @ 1:04–1:15          |
| Snare                           | holds the first monk that walks in for good; others walk past                             | S-018 @ 0:23–0:48          |
| Alcove                          | hiding place: a player inside cannot be caught                                            | S-018 @ 0:02–0:19, S-100   |
| Monk speed                      | 2/3 of the runner's                                                                       | **Provisional**, 1982 feel |
| Monk chase AI                   | classic floor scan (see Monks)                                                            | 1982 rule [^lrtr]          |
| Monk stuck in a hole            | 120 ticks (2 s), then climbs out                                                          | **Provisional**            |
| Runner standing on a hole       | the monk inside cannot climb out until the runner leaves                                  | S-100 (2026-10-28)         |
| Monk respawn                    | after 60 ticks, second row, random                                                        | 1982 rule [^lrtr]          |
| Monk carries gold               | 12 to 37 cells, then drops it                                                             | 1982 rule [^lrtr]          |
| Caught by a monk                | same centre cell                                                                          | **Provisional**            |

[^lrtr]:
    1982 rules as reimplemented by _Lode Runner Total Recall_ (S-004), `ok2Dig()` in
    [`lodeRunner.runner.js`](https://github.com/SimonHung/LodeRunner_TotalRecall/blob/master/lodeRunner.runner.js):
    only the target and the cell above it are checked. The monk rules come from
    `lodeRunner.guard.js` in the same project. Still to check against TLR.

## Intentional deviations from the original

| Deviation                                                                                                        | Reason                                                |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| A trapped monk with no room above its hole keeps its gold (1982: it is lost), even if it then dies and reappears | Losing gold would make the level impossible to finish |
