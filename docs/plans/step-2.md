# Step 2 plan: level editor v1

Status: **approved** (PR #17). Roadmap: `docs/PRD.md` §7, step 2.
Backlog items: B-011 to B-017.

## Goal

Anyone in the family can open the game, switch to the editor, paint a level with the
mouse, test it straight away, keep it in the browser, and send it to someone else as a
file or as a link. The person who opens the link plays that level, or edits it.

Out of scope for step 2: level packs, level metadata beyond name and size (world, tile
set, day/night, music, tools: they come with the TLR terrain and tools in step 3 and
need format v2), TLR-only tiles, 2 players, menus beyond what the editor needs.

## Key design decisions

1. **No format change.** The editor reads and writes level format v1 as it is. Every
   level it produces goes through `parseLevel` before it is saved, tested, exported or
   shared, so the editor can never produce a level the game would reject.
2. **Pure editor model.** The editing logic (`src/editor/model.ts`) is plain data and
   pure functions (paint, fill a line, resize, undo/redo), like the simulation. The DOM
   layer only turns mouse and keyboard events into model operations, so the editor is
   unit-testable without a browser.
3. **Simple validation; the maker proves the level.** The validator's errors (no
   runner, no gold, no exit, too many monks…) block testing and sharing, and are shown
   translated next to the grid. There is **no reachability check**: a path search
   cannot know every route the player may dig, so it would reject good levels. The
   maker plays the level with "Test" to check it can be finished (decided 2026-10-25;
   a possible warning is kept in PRD Growth).
4. **Share links carry the level in the URL fragment** (`#level=…`): the JSON is
   compressed with the browser's built-in `CompressionStream("deflate-raw")` (no new
   dependency) and encoded in base64url. The fragment is never sent to a server.
   Opening a link is untrusted input: capped encoded length, capped decompressed size
   (streamed, aborted past 64 KB), then `parseLevel`.
5. **Storage: `localStorage`**, one versioned key holding the list of my levels. Levels
   are capped at 64 KB, so a few dozen fit easily; IndexedDB is not needed yet. What is
   read back is untrusted too (another tab, an old version, a user edit) and goes
   through `parseLevel`; a broken entry is skipped and reported, never crashes the app.
   File export/import is the backup, as the PRD requires.
6. **Screens by URL hash:** `#play` (default), `#edit`, `#level=…` (play a shared
   level, with an "Edit" button). The back button works, and nothing needs a server.
7. **Editing controls:** left button paints the selected tile, right button erases;
   dragging paints along the path (cells in between are filled, so fast moves leave no
   gaps); number keys pick a tile; `Ctrl+Z` / `Ctrl+Y` undo and redo. Placing a second
   runner start moves it (exactly one `P` in v1).

## Delivery: one PR per backlog item

| Order | PR           | Backlog | Visible result                                         |
| ----- | ------------ | ------- | ------------------------------------------------------ |
| 1     | Screens      | B-011   | a Play / Editor switch; the editor shows a blank grid  |
| 2     | Editor model | B-012   | none (pure model and its tests)                        |
| 3     | Painting     | B-013   | **paint a level with the mouse**                       |
| 4     | Test play    | B-014   | **play the level being edited, then go back to it**    |
| 5     | My levels    | B-015   | levels kept in the browser: save, open, rename, delete |
| 6     | Files        | B-016   | export and import `.json` files                        |
| 7     | Share links  | B-017   | **send a link that opens the level**                   |

Every UI string lands in EN and FR in the same PR, and every visible change comes with
a screenshot in its PR.

## Modules and enumerated tests

### B-011 — Screens and routing

- `src/app/route.ts`: `parseRoute(hash)` → `{ screen: "play" } | { screen: "edit" } |
{ screen: "shared", payload }`, and `routeHash(route)`.
- `src/main.ts`: shows one screen at a time; the game loop runs only on play screens.

`tests/app/route.test.ts`

- `""`, `#`, `#play` → play; `#edit` → edit; `#level=abc` → shared with payload `abc`;
- unknown hashes (wrong case, trailing characters, empty payload, no `#`) fall back to
  play;
- `parseRoute(routeHash(r))` gives back every known route `r`;
- a payload at the share-link cap is kept; one character longer is rejected at routing
  (never decoded).

`tests/editor/blank.test.ts`

- a new grid is 28×16 by default, empty rows on a bedrock floor; any size within the
  format limits works, and sizes outside them (too big, negative, not integers) are
  clamped.

`tests/render/grid.test.ts`

- `gridCanvasSize` is the grid size times `TILE_PX`, and 0 × 0 for an empty grid;
- `renderGrid` fills the background first, draws start markers as the runner and monk
  (not as tiles), and does not throw on an empty grid.

### B-012 — Editor model

- `src/editor/model.ts`: `EditorState` (grid, name, selected tile, undo and redo
  stacks); `paint`, `paintLine`, `erase`, `resize`, `rename`, `undo`, `redo`;
  `toLevel(state)` builds a v1 level and runs `parseLevel` on it.

`tests/editor/model.test.ts`

- a new level is 28×16, empty, with a bedrock floor, and takes the name it is given
  (the UI passes the translated default name);
- `paint` sets one cell; painting the same tile again is a no-op (no undo entry);
- placing `P` where a runner start already exists moves it (exactly one `P` remains);
- painting outside the grid changes nothing;
- `lineCells` covers both ends with no gaps, checked on 500 random segments;
  `paintLine` fills every cell between two points (Bresenham), in both directions and
  on diagonals;
- one mouse stroke (press → drag → release) is one undo step; a stroke that changes
  nothing adds none;
- `undo` then `redo` restores the exact grid; a new edit clears the redo stack; undo
  history is capped (oldest steps dropped);
- `resize` keeps the top-left content, crops or pads with empty cells, and is clamped to
  the format limits (8–64 × 8–48);
- `rename` caps the name at 64 code points and keeps spaces while typing; the saved
  document is trimmed;
- `toLevel` returns the validator's error codes for an invalid grid (no `P`, no `$`, no
  `E`, 17 `M`) and a level for a valid one;
- randomized: 2,000 random edit sequences never leave the grid out of shape (row count
  and widths always match the size).

### B-013 — Painting UI

- `src/editor/view.ts`: palette (one button per tile, with its translated name and
  number key), name and size fields, the grid drawn with the game's renderer.
- `src/editor/pointer.ts`: canvas pixel → cell, button → paint or erase.

`tests/editor/pointer.test.ts`

- pixel → cell at the corners and edges of each cell, at any CSS scale of the canvas;
- outside the grid → no cell;
- left button paints, right button erases, other buttons do nothing.
- a stroke ends on pointer release, cancel or lost capture (releasing outside the
  window must not merge later edits into one undo step).

`tests/i18n.test.ts` (existing): still checks that EN and FR have the same keys.

### B-014 — Test play

- "Test" runs the edited level in a play session; `Esc` or "Back to editor" returns to
  the editor with its state, undo history included.
- A test cannot start while the level has validation errors; they are listed,
  translated (one message per error code).

`tests/editor/test-play.test.ts`

- a valid level starts a session whose start state equals `createState(level, seed)`;
- an invalid one returns its error codes and starts nothing;
- returning keeps the editor state unchanged (same grid, same undo stack).

`tests/i18n.test.ts`

- every `LevelErrorCode` has an EN and a FR message.

### B-015 — My levels (browser storage)

- `src/storage/levels.ts`: `listLevels`, `saveLevel`, `deleteLevel`, `renameLevel`,
  over a `Storage`-like interface (the real `localStorage` in the app, an in-memory fake
  in tests). One key, versioned: `rotr.levels.v1`.

`tests/storage/levels.test.ts`

- save then list returns the level; saving under an existing id replaces it;
- delete and rename work and keep the other levels untouched;
- the stored document is validated on read: a corrupt entry is skipped and reported,
  the others still load; a corrupt whole document (not JSON, wrong version) returns an
  empty list and an error, and is not overwritten until the next save;
- a full storage (`QuotaExceededError`) returns an error instead of throwing;
- ids are unique (a counter in the document, never `Math.random` or the clock).

### B-016 — Export and import files

- Export downloads `<name>.rotr.json`, the exact v1 document. Import uses a file
  picker; files over 64 KB are rejected before they are read.

`tests/level/export.test.ts`

- export then import gives back the same level (byte-identical JSON);
- an oversized file is rejected without reading it; an invalid one returns the
  validator's errors.

### B-017 — Share links

- `src/share/link.ts`: `encodeLevel(level)` → base64url of deflate-raw of the canonical
  JSON; `decodeLevel(payload)` → the level or an error code (`too-long`, `not-base64`,
  `not-deflate`, `too-large`, then the validator's codes).
- "Share" copies `https://…/#level=<payload>`; opening it plays the level, with an
  "Edit" button that copies it into my levels.

`tests/share/link.test.ts`

- round trip: `decodeLevel(encodeLevel(l))` equals `l` for every level fixture and for
  2,000 random valid levels;
- the bundled level's link is under 1,000 characters;
- rejects: payloads past the length cap, non-base64url characters, data that is not
  deflate, and a "zip bomb" (a small payload that inflates past 64 KB: decoding stops
  at the cap, it does not inflate it all);
- never throws on 2,000 random strings and 2,000 mutations of a valid payload.

`e2e/share.spec.ts` (Playwright, Chromium, Firefox and WebKit)

- a link made in Node opens in each browser and shows the right level (its name and
  grid), so `CompressionStream` behaves the same in all three engines.

`/security-review` runs on B-016 and B-017 (file loading, share links).

## Open questions (faithfulness)

1. What did TLR's own editor look like and do? Anything you remember (palette layout,
   test button, keyboard shortcuts) can shape this one.
2. Grid size of TLR levels (still open from step 1): the editor defaults to 28×16 and
   lets you change it, so nothing is blocked.
3. Should a shared link open the level in play mode (current plan) or in the editor?
