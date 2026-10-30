# Backlog

Scoped work items. Ideas start in the Growth section of `docs/PRD.md`.
Each item lands in its own commit, which also flips its status here.
Step 1 (B-004 to B-010) is planned in [`plans/step-1.md`](plans/step-1.md), step 2 (B-011 to
B-017) in [`plans/step-2.md`](plans/step-2.md), step 3 (B-019 to B-029, then B-038, B-039 and B-041) in
[`plans/step-3.md`](plans/step-3.md), step 4 part A, the look (B-030 to B-036), in
[`plans/step-4.md`](plans/step-4.md), each with its delivery order.

Statuses: `todo` / `in-progress` / `done`.

| ID    | Item                                                    | Acceptance criteria                                                                                                                                         | Status |
| ----- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| B-001 | Project skeleton (step 0)                               | TS strict + Vite build; ESLint + Prettier; Vitest; EN/FR i18n with a test that both catalogs have the same keys; strict CSP                                 | done   |
| B-002 | CI                                                      | On every PR and push to `main`: `npm ci`, typecheck, lint, test, build, `npm audit --omit=dev`, gitleaks over full history                                  | done   |
| B-003 | GitHub Pages deploy                                     | Push to `main` publishes `dist/` to Pages; workflow has least-privilege permissions; actions pinned by SHA                                                  | done   |
| B-004 | Level format v1 + validator                             | JSON schema documented in ARCHITECTURE; strict validator rejects unknown versions, oversized grids and unknown tiles; fuzz test with random/malformed input | done   |
| B-005 | Simulation core: grid, movement, ladders, bars, falling | Pure module under `src/sim/`; enumerated unit tests per rule                                                                                                | done   |
| B-006 | Digging and hole refill                                 | Dig left/right, refill timer, player death in refilled hole; unit tests                                                                                     | done   |
| B-007 | Gold and exit                                           | Collect all gold, exit appears/opens, level complete; unit tests                                                                                            | done   |
| B-008 | Monks and AI                                            | Chase, fall into holes, carry/drop gold, respawn; randomized cross-check of pathfinding against a naive reference                                           | done   |
| B-009 | Renderer + input + first playable level                 | Canvas renderer, keyboard input, one hand-made level playable in the deployed build                                                                         | done   |
| B-010 | Replay determinism                                      | Recorded input log replays to the same state hash in Node and in headless browsers (Playwright: Chromium, Firefox, WebKit)                                  | done   |
| B-011 | Screens and routing                                     | Play / Editor switch by URL hash (`#play`, `#edit`, `#level=…`); back button works; game loop runs only on play screens                                     | done   |
| B-012 | Editor model                                            | Pure model: paint, line, erase, resize, rename, undo/redo; one stroke = one undo step; output always goes through `parseLevel`; randomized shape test       | done   |
| B-013 | Painting UI                                             | Palette with translated tile names and number keys; left paints, right erases, drag fills gaps; name and size fields; EN + FR                               | done   |
| B-014 | Test play                                               | "Test" plays the edited level and returns to the editor unchanged; blocked with translated errors while the level is invalid                                | done   |
| B-015 | My levels (browser storage)                             | Save (drafts too), list, open, delete in `localStorage`; stored data validated on read; corrupt entries skipped and reported; quota errors handled          | done   |
| B-016 | Export / import files                                   | Download and import `.rotr.json` (64 KB cap before reading); invalid files report the validator's translated errors                                         | done   |
| B-017 | Share links                                             | Level in the URL fragment (deflate-raw + base64url); length and decompressed-size caps; fuzzed; link opens in Chromium, Firefox and WebKit (Playwright)     | done   |
| B-018 | E2E tests of the game's screens                         | Playwright specs on the built game in 3 engines (Replays job): test, My levels, files, share, Edit a copy; runs the ARCHITECTURE browser quirks             | todo   |
| B-019 | Level format v2 + migration                             | New TLR tiles and `teleports` links; v2 fixtures per error code; fuzzed. v1 migration shipped, then dropped (unused; 2026-10-28)                            | done   |
| B-020 | Two players: co-op                                      | `players` list from `P`/`Q`; per-player keys on one keyboard; shared gold; monks chase the nearest player; two-player replay in 4 engines                   | done   |
| B-021 | Two players: versus                                     | Per-player gold count; winner banner (EN + FR); a player can bury the other; replay fixture                                                                 | done   |
| B-022 | Terrain                                                 | Trapdoor turf, gooey turf, hidden ladder, alcove (hiding place), monk respawn points: playable and in the editor palette; replay fixture                    | done   |
| B-023 | Teleporters                                             | One-way entrance → exit; links edited in the editor and kept valid by undo; replay fixture                                                                  | done   |
| B-024 | Item slot, keys, doors, exit                            | One item per player (pick up swaps); a carried key opens its doors; exit appears with the last gold; in the palette; replay fixture                         | done   |
| B-025 | Tools: jackhammer, pickaxe                              | Used from the item slot; jackhammer digs bedrock; pickaxe rubble falls and blocks; item count never changes (randomized)                                    | done   |
| B-026 | Bombs                                                   | Per-level bomb counter; fuse; small bomb: temporary crater, bedrock intact; big bomb: permanent, spares the exit; chain reactions; kills actors in range    | done   |
| B-027 | Snare and gas                                           | Snare holds the first monk that walks in, for good; gas dazes every monk in its cloud, not on ladders or bars; replay fixture                               | done   |
| B-028 | Goo bucket                                              | Turns the floor under the 3 cells in front into gooey turf; slows players and monks; replay fixture                                                         | done   |
| B-029 | Fix: a runner on a hole holds the monk in it            | A trapped monk cannot climb while the runner stands in the cell above its hole; it climbs out once the runner leaves; regression test                       | done   |
| B-030 | Art direction                                           | Three mockups (neo-pixel, illustrated, flat glow) of one level in two worlds; Guillaume picks one; style guide in ARCHITECTURE; nothing extracted           | todo   |
| B-031 | Sprite renderer                                         | Sprite sheets from `'self'`; DPR-aware canvas; placeholder fallback; every tile has art or a placeholder (tested); all replay hashes unchanged              | todo   |
| B-032 | Runners and monks                                       | Two distinct runners and monks, animated for every action (run, climb, bar, fall, dig, die, trapped, snared…); one animation per action (tested)            | todo   |
| B-033 | Terrain and items (Moss world)                          | Every v2 tile and step 3 item drawn; hole refill stages shown; keys and doors differ by shape and colour                                                    | todo   |
| B-034 | Effects                                                 | Dust, sparkle, blasts, gas, teleport, death; capped (randomized); off or reduced under `prefers-reduced-motion`                                             | todo   |
| B-035 | Worlds and day/night                                    | Ten world sets and backdrops, night variant; format v3 `world`/`night` with v2 → v3 migration and fixtures; editor picker (EN + FR)                         | todo   |
| B-036 | Frame, HUD and editor                                   | Framed playfield and status bar per player in the chosen style; editor palette shows the art; strings EN + FR                                               | todo   |
| B-037 | Fix: touching a cell favours moving right               | Reaching a cell (gold, exit, monk) takes the same distance both ways (today 1 sub-unit less to the right); a mirrored race is a draw; regression test       | todo   |
| B-038 | Fix: a monk stops at the edge of a pit                  | A monk whose way down is a pit or trapdoor turf walks to its column and drops, from either side; regression test; affected replays re-recorded              | done   |
| B-039 | Default level shows step 3                              | Bundled level uses every step 3 feature so far and has a player 2 start; a replay wins it with its monk; updated again at the end of step 3                 | done   |
| B-041 | Fix: hiding in an alcove takes up, leaving takes down   | Walking through does not hide; up hides, down comes out; hidden: no actions, never caught; monks roam meanwhile; regression test; replay fixture            | done   |
