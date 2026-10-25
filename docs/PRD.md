# PRD — Return of the Runners

_A fan remake of Lode Runner: The Legend Returns._

## 1. Vision

A faithful, browser-playable remake of _Lode Runner: The Legend Returns_
(Presage/Sierra, 1994), with its level editor, so that a small group of family
players can relive the game from a simple link and challenge each other with
their own levels.

## 2. Users

- **Players:** the author and their family (a brother and a cousin). They played the original on
  Windows 95/98 and expect it to _feel_ like the original.
- **Level designers:** the same people, sharing levels with each other.

## 3. Goals and non-goals

### Goals

- Gameplay and look faithful to the original (rules, tiles, tools, monk behavior,
  timings, art style). The reference is TLR (1994), not the 1982 game: a 1982 rule
  is only a provisional fallback where TLR's behavior is not known yet.
- An integrated level editor with level packs and easy sharing.
- 1 player, plus 2 players (co-op and versus) on the **same keyboard**.
- Zero install: play from a link.

### Non-goals

- Online multiplayer.
- Mobile/touch support.
- Decoding or shipping the original 150 levels or any original asset.

## 4. Functional requirements

### 4.1 Core gameplay (from the 1982 original)

- One-screen grid levels: diggable brick, ladders, hand-over-hand bars, gold, exit.
- Dig left/right; holes refill after a delay; trapped monks die and respawn; a player
  trapped in a refilling hole dies.
- Monks chase players, carry and drop gold, fall into holes, can be walked on.
- No jumping; falls are harmless.

### 4.2 The Legend Returns additions

- Special terrain: bedrock, trapdoor turf, gooey turf.
- Tools (one carried at a time): snare, gas spray, jackhammer, small and big bomb,
  pickaxe, goo bucket. Further items to be confirmed from playtests/videos.
- 10 worlds with their own tile sets; day/night variants.
- Exact rules and timings are captured with provenance in `docs/ARCHITECTURE.md`.

### 4.3 Level editor

- Tile palette, paint with the mouse, "Test" button for instant play.
- Level metadata: name, world/tile set, day/night, music, tools.
- Level packs (ordered lists of levels).
- Validator: exactly one player start, at least one gold and one exit. Whether the
  level can be finished is checked by the maker with "Test", not by the validator
  (decided 2026-10-25: a path search cannot foresee every dug route).
- Sharing: export/import as a file, or as a link with the level compressed in the URL.

### 4.4 Controls

- Keyboard for 1 or 2 players; default bindings avoid common keyboard-ghosting
  combos (each player's keys on opposite sides of the keyboard).
- All bindings remappable; gamepad support via the Gamepad API.

### 4.5 Player data

- Levels created in the editor are stored in the browser (IndexedDB/localStorage).
- Since clearing browser data wipes them, export/import as files (backup) is always
  available.

### 4.6 Localization

- UI available in **English and French** from the first release.

## 5. Non-functional requirements

- **Platforms:** latest desktop Chrome, Firefox and Safari.
- **Performance:** stable 60 fps on a mid-range laptop; production bundle (excluding
  audio/graphics) under 300 KB gzipped.
- **Hosting:** static site on GitHub Pages; no backend.
- **Security:** level files and share links are untrusted input (see CLAUDE.md §5).

## 6. Content and licensing

- **Code:** GPL-3.0-or-later.
- **Our assets and levels** (graphics, sounds, music, level packs): CC BY-SA 4.0.
- **Third-party assets:** only under compatible licenses (CC0, CC BY, CC BY-SA,
  GPL-3.0), recorded in `ASSETS.md`.
- **Original game:** no extracted asset or data. Original levels may be recreated by
  hand from screenshots/videos for family use, kept in a separate pack.
- **Naming:** the public name is **Return of the Runners** (chosen 2026-10-24), so the
  "Lode Runner" trademark is not used as the product name. Original character names
  (Jake Peril, Wes Reckless) are not used either; our heroes get their own names.

## 7. Roadmap

| Step | Content                                                                              | Outcome                   |
| ---- | ------------------------------------------------------------------------------------ | ------------------------- |
| 0    | Repo, TS/Vite skeleton, CI, GitHub Pages deploy                                      | A link that opens         |
| 1    | Core engine: grid, movement, ladders, bars, falling, digging, gold, monks + AI, exit | First playable level      |
| 2    | Editor v1: paint, test, save, export, share by link                                  | We can create levels      |
| 3    | TLR specifics: terrain, tools, 2-player co-op and versus                             | The "real" Legend Returns |
| 4    | World tile sets, day/night, music, packs, menus, scores, EN/FR                       | Complete game             |

## 8. Growth

The feature funnel. New ideas and deferred scope land here first; scoped work
graduates to `docs/BACKLOG.md`. Statuses flip in the same commit that lands or
rejects the feature.

| Idea                                                            | Status   | Notes                                            |
| --------------------------------------------------------------- | -------- | ------------------------------------------------ |
| Hand-recreated original levels pack (from longplay screenshots) | proposed | Separate pack, family use                        |
| Local importer for files from one's own copy of the original    | proposed | Reverse-engineering track; nothing redistributed |
| Replays (record/playback from input log)                        | proposed | Format and player exist (B-010); needs the UI    |
| Editor warning for gold or exit unreachable without digging     | proposed | Only if makers ask for it; never blocking        |
| Recreated art in the style of TLR (1994): sprites, tile sets    | planned  | Placeholders until then; never extracted assets  |
| Online multiplayer                                              | rejected | Same keyboard is enough (2026-10-24)             |
| Decoding the original 150 levels                                | rejected | No public source found (2026-10-24)              |
| Mobile/touch controls                                           | rejected | Out of scope                                     |

## 9. Open questions

- Names of the two heroes (and of the monks?).
- Full list of TLR tools and items, and their exact behavior (to be confirmed by playtests/videos).
