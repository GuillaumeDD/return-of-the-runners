# Backlog

Scoped work items. Ideas start in the Growth section of `docs/PRD.md`.
Each item lands in its own commit, which also flips its status here.
Step 1 (B-004 to B-010) is planned in [`plans/step-1.md`](plans/step-1.md), step 2 (B-011 to
B-017) in [`plans/step-2.md`](plans/step-2.md), each with its delivery order.

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
