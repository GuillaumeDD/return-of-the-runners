# Step 3 plan: TLR specifics (terrain, tools, two players)

Status: **draft**, to be approved. Roadmap: `docs/PRD.md` §7, step 3.
Backlog items: B-019 to B-028. Source ids (`S-…`) refer to [`../SOURCES.md`](../SOURCES.md).

## Goal

Levels look and play like _The Legend Returns_ rather than the 1982 game: TLR's
special terrain, its tools, teleporters, keys and doors, and two players on the same
keyboard, working together or racing each other. Everything new can be placed in the
editor in the same PR that makes it playable, so the family can build TLR-style levels
as each piece lands.

Out of scope for step 3 (step 4): world tile sets and art, day/night, music, level
packs and menus, scores, remappable keys and gamepads. Timings stay **provisional**
until checked against a video or Guillaume's playtest.

## What we know, and how sure we are

YouTube refuses to serve the longplay videos to the cloud session (HTTP 403), so
Guillaume sent eleven episodes of the S-010 longplay and a two-player clip as files
(S-014 to S-025, PC version, 640 × 480). What they show is in the second table, with timestamps. The web
pages in the first table were read through search-engine excerpts only (the pages are
outside the session's allowed domains), so those facts are **to confirm** unless a
video or Guillaume backs them. Guillaume's memory (S-100) wins over every source.

| Element                    | What the sources say                                                                                                          | Sources             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Grid                       | 28 × 16 tiles (already our default); measured on the PC version too                                                           | S-001, S-015        |
| Worlds                     | 10 worlds: Moss, Fungus, Ancient, Crystal, Ice, Fossil, Lava, Phosphorus, Dark, Industrial (art only, step 4)                 | S-010 titles        |
| Bedrock (concrete)         | Cannot be dug or blasted by a small bomb; only the jackhammer or a big bomb gets through                                      | S-001, S-002        |
| Trapdoor turf (fake brick) | Looks like brick but is empty: actors fall through it                                                                         | S-002, S-008        |
| Gooey turf                 | Slows both the players and the monks                                                                                          | S-002               |
| Hidden ladder              | Appears once all the gold is taken                                                                                            | S-001, S-005        |
| Teleporter                 | One-way: an entrance and an exit, linked in the editor; several entrances may lead to one exit                                | S-001               |
| Keys and doors             | Three colours; each key opens the door of its colour; some levels need a key to reach the exit (seen: S-016)                  | S-001, S-016        |
| Monk respawn point         | An editor element: where dead monks reappear                                                                                  | S-001               |
| Tools                      | Picked up and used one at a time                                                                                              | S-002, S-003        |
| Jackhammer (drill)         | Digs through bedrock                                                                                                          | S-001, S-002        |
| Pickaxe                    | Brings a pile of rock down from the ceiling, which blocks monks; the rock falls faster than monks                             | S-002, S-005, S-006 |
| Small bomb                 | Blows a temporary hole, bigger than a dug one (seen: S-015); kills monks caught in it                                         | S-002, S-007, S-015 |
| Big bomb                   | Destroys terrain for good (bedrock too), everything except the exit                                                           | S-002, S-007        |
| Snare                      | Dropped in a monk's path; the monk that walks on it hangs upside down for a while. A player can be caught by it too           | S-007               |
| Gas spray                  | Leaves a monk in front of the player dazed for a few seconds; monks on ladders or bars are immune                             | S-005, S-007        |
| Goo bucket                 | Covers a surface with goo (gooey turf), which slows whoever crosses it                                                        | S-002               |
| Two players                | Same screen, at the same time; co-op, or competing for the gold; 30 two-player levels in the original                         | S-002, S-003, S-008 |
| Controls                   | Per player: move, dig left, dig right, pick up/drop a tool, use the tool, small bomb (S-003); P1 on the keypad in DOS (S-008) | S-003, S-008        |

### Seen in the videos (S-014 to S-025)

Timestamps are positions in each episode file. Times were read at 2 frames per second,
so they are good to about half a second.

| Behavior                      | What the video shows                                                                                                                                           | Where                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Grid                          | The playfield is 28 tiles wide and 16 high (about 22 × 26 px per tile at 640 × 480), above a status bar                                                        | S-015 @ 0:30, S-014 @ 1:00      |
| Exit appears with the gold    | No exit is drawn while gold is left; a green door appears the moment the last gold is taken                                                                    | S-015 @ 1:22–1:23, @ 3:05       |
| Exit behind a key door        | Level 104: the exit is a red door marked with an X; the runner brings the red key, the door turns into the green exit and the runner leaves                    | S-016 @ 3:30–3:33               |
| Keys use the tool slot        | Picking up the key swaps it with the tool held: the status bar shows the key, and the old tool lies where the key was                                          | S-016 @ 3:03–3:05               |
| Bombs are a separate counter  | Bombs lying in the level are collected into a counter shown in the status bar (up to 4 seen), apart from the tool slot. The counter starts empty on each level | S-015 @ 0:01–0:20, @ 1:36–1:40  |
| Bomb fuse                     | A bomb laid by the runner burns for about 2.5 s, then explodes                                                                                                 | S-015 @ 1:05–1:07.5             |
| Chain reaction                | The blast lights a bomb lying next to it, which explodes about 2.5 s later and lights the next one                                                             | S-015 @ 1:07.5–1:10.5           |
| Blasted terrain comes back    | Blocks destroyed by these bombs reappear about 13 s later, one after the other                                                                                 | S-015 @ 1:07.5–1:24             |
| Lives                         | One extra life for each finished level, shown up to 99 (step 4: lives and scores)                                                                              | S-015 @ 1:32–1:36, S-016        |
| Hidden ladders and exits      | In the two-player level, two ladders and two exit doors appear in the middle the moment the gold is gone                                                       | S-025 @ 0:00–0:04               |
| Several exits                 | Level 91 shows two exit doors at once                                                                                                                          | S-020 @ 1:36                    |
| Held item kept between levels | The item in the slot is still there at the start of the next level                                                                                             | S-020 @ 1:36–1:39, @ 5:49–5:51  |
| Jackhammer                    | The runner rides it straight down through brick, about 5 tiles in 9 s; the shaft stays open behind (a monk follows it down); the tool stays in the slot        | S-019 @ 2:33–2:43               |
| Gas gun                       | Each use puts a green cloud about 2 tiles wide in front of the runner; it stays about 6 s and monks inside are stuck, then dazed; used twice in 3 s, kept      | S-021 @ 0:54–1:04, S-023 @ 4:23 |
| Two players                   | One shared screen; a mirrored level with a wall in the middle, so each player has a half; no monks; separate scores, lives, tool slots and bomb counters       | S-025                           |
| Two-player race               | Both collect their gold, then dig and bomb their way to their own exit; the first one there wins (P1 reaches it first, the clip ends)                          | S-025 @ 0:04–1:24               |

## Key design decisions

1. **Level format v2, one migration.** Every new element needs format support, so v2
   lands first and alone (B-019) with all the new tiles reserved, a v1 → v2 migration
   and fixtures for both versions. Later items only add behavior, never format. A v1
   file, link or stored level still opens (migrated on read); the app writes v2 only.
2. **One tile per cell, plus a teleporter link list.** The grid stays a list of strings
   (readable, diffable, short links). Teleporter links cannot live in a cell, so v2 adds
   one optional field, `teleports: [[fromX, fromY, toX, toY], …]`, validated against
   the grid (every entrance linked to exactly one exit). Proposed characters (final
   list in ARCHITECTURE with B-019):

   | Char | Element            | Char    | Element                  |
   | ---- | ------------------ | ------- | ------------------------ |
   | `Q`  | player 2 start     | `T`     | teleporter entrance      |
   | `%`  | trapdoor turf      | `t`     | teleporter exit          |
   | `~`  | gooey turf         | `a b c` | keys (red, green, blue)  |
   | `h`  | hidden ladder      | `A B C` | doors (red, green, blue) |
   | `R`  | monk respawn point | `j`     | jackhammer               |
   | `k`  | pickaxe            | `o`     | small bomb               |
   | `O`  | big bomb           | `s`     | snare                    |
   | `g`  | gas spray          | `u`     | goo bucket               |

   The editor's "alcove" element (S-001) is not reserved until we know what it does.

3. **Players are a list.** `GameState.runner` becomes `players: Player[]` (one or two),
   each with its own input, tool slot and status; replays record one input stream per
   player. Single-player replays are migrated, and their hashes are expected to change
   once, in B-020, with the reason stated in the PR.
4. **Tools are items on the grid until picked up.** A tool lies in a cell like gold;
   the "pick up" key takes it, and a player already holding something leaves that item
   in the cell (a swap, as seen in S-016 @ 3:03–3:05). "Use" uses it. Keys go in the
   same slot. **Bombs do not**: they are collected into a per-player counter that starts
   at 0 on each level, and laid with their own key (S-015, S-003).
5. **Every effect is a timed, deterministic object** in the state, like holes: bomb
   craters, rubble piles, goo, snares, dazed monks. Each has an age and phases derived
   from it; the update order within a tick is written down in ARCHITECTURE. No new
   randomness is needed beyond the existing PRNG.
6. **Default keys, two players on one keyboard.** P1 keeps the arrows plus keys near the
   right-hand side (`/`, `.`, `,`, right Shift…), P2 gets `WASD`-style keys on the left
   (by `KeyboardEvent.code`, so AZERTY works). Both sets are tested against common
   ghosting combos by hand (Guillaume's keyboard) before B-020 merges. Remapping stays
   in step 4.
7. **Editor gets each element with its behavior.** Each item adds its palette entries
   (EN + FR names), its validator rules and its replay fixture in the same PR, so an
   element is never in the palette without working in "Test".

## Delivery: one PR per backlog item

| Order | PR                  | Backlog | Visible result                                           |
| ----- | ------------------- | ------- | -------------------------------------------------------- |
| 1     | Format v2           | B-019   | none (old levels still open; the editor saves v2)        |
| 2     | Two players: co-op  | B-020   | **two runners on one keyboard, same level**              |
| 3     | Two players: versus | B-021   | **race for the gold**, winner shown                      |
| 4     | Terrain             | B-022   | trapdoor, gooey turf, hidden ladder, monk respawn points |
| 5     | Teleporters         | B-023   | teleporters, linked in the editor                        |
| 6     | Keys, doors, exit   | B-024   | the item slot; three key/door colours; exit appears      |
| 7     | Tools, part 1       | B-025   | **jackhammer** and **pickaxe** in the slot               |
| 8     | Bombs               | B-026   | bomb counter; small and big bombs, chain reactions       |
| 9     | Snare and gas       | B-027   | ways to stop monks without digging                       |
| 10    | Goo bucket          | B-028   | spread goo to slow monks down                            |

Two players come early: playing together is the reason the project exists. B-018 (e2e
tests of the screens) stays independent and can land at any point.

Every UI string lands in EN and FR in the same PR, every visible change comes with a
screenshot, and every gameplay item adds at least one replay fixture (Node, Chromium,
Firefox, WebKit) and updates ARCHITECTURE § Observed behavior with its sources.

## Modules and enumerated tests

### B-019 — Level format v2 and migration

- `src/level/format.ts`: v2 tile alphabet and limits; `src/level/parse.ts` reads v1
  and v2; `src/level/migrate.ts`: `migrateV1(doc) → v2 doc` (pure).
- Validator rules: exactly one `P`, at most one `Q`; teleports reference an entrance
  and an exit inside the grid, every `T` linked once, no link without both ends; at
  most 16 monks; keys and doors may exist without each other (the maker tests).
- File export, share links and storage write v2; reading v1 migrates.

`tests/level/migrate.test.ts`

- every v1 valid fixture migrates to a v2 document that validates and has the same
  grid; migrating twice is refused (already v2); a v1 invalid fixture stays invalid
  with the same error codes.

`tests/level/parse.test.ts` (v2 cases)

- every new character is accepted; an unknown one is `unknown-tile`;
- two `Q` → `player2-count`; teleports: a link from a non-entrance, to a non-exit, out
  of the grid, duplicated, or an unlinked `T` → each its own code; `teleports` with
  the wrong shape (not an array, wrong arity, non-integers) → `invalid-teleports`;
- fixtures in `tests/fixtures/levels/v2/{valid,invalid}`, one per error code;
- the fuzzer runs over v2 documents too (random and mutated), never throws, and
  anything accepted satisfies the invariants.

`tests/share/link.test.ts`, `tests/level/file.test.ts`, `tests/storage/levels.test.ts`

- a v1 link, file and stored level open as their v2 migration; v2 round trips stay
  byte-identical.

### B-020 — Two players: co-op

- `src/sim/state.ts`: `players: Player[]` built from `P` then `Q`; `src/sim/input.ts`:
  `TickInput = PlayerInput[]`; `src/sim/replay.ts`: replay v2 with one log per player,
  v1 replays migrated; `src/input/keyboard.ts`: bindings per player.
- Co-op rules (defaults, to confirm): gold is shared; the exit opens when all gold is
  taken; the level is won when **one** player reaches the exit; a player who dies
  comes back at its start after `RESTART_DELAY_TICKS` while the other keeps playing;
  players do not block each other. Monks chase the nearest player.
- A level with a `Q` is offered in 1-player or 2-player mode; with one player, `Q` is
  ignored.

`tests/sim/players.test.ts`

- each player moves only with its own input; both can dig on the same tick;
- gold taken by either lowers `goldLeft`; the exit opens for both;
- one player reaching the open exit wins the level;
- a dead player respawns at its start and the other's state is untouched;
- two players can share a cell (no blocking) and a hole.

`tests/sim/ai.test.ts`: a monk picks the nearer player (cross-checked against the naive
reference on random two-player levels); ties go to P1.

`tests/sim/replay.test.ts`: every v1 replay migrates and runs; a two-player fixture
reaches its committed hash in Node and the three browsers.

`tests/input/keyboard.test.ts`: P1 and P2 default bindings share no key; each player's
keys produce only that player's input.

### B-021 — Two players: versus

- Versus mode chosen at start for levels with a `Q`. Seen in S-025: a race on a
  mirrored level, each player in their own half with their own gold and their own exit;
  both exits appear when all the gold is taken, and the first player out wins. Each
  player has their own score, lives, item slot and bomb counter. Defaults to confirm:
  the level waits for both halves' gold before the exits appear; a caught or buried
  player respawns at its start and drops any carried item.
- `src/game/session.ts`: mode, per-player score, end-of-level banner (EN + FR).

`tests/sim/versus.test.ts`

- gold goes to the collecting player's count; the total never changes;
- the exits appear only when all gold is taken; the first player to reach an exit wins
  and the level ends on that tick; both on the same tick is a draw;
- a player can trap the other in a hole it digs (the hole kills like for monks).

### B-022 — Terrain

- Trapdoor turf: drawn like brick, behaves as empty for support and digging (cannot be
  dug, since there is nothing there).
- Gooey turf: solid floor that cannot be dug; whoever walks on it moves at
  `GOO_PERIOD` (slower, provisional).
- Hidden ladder: invisible and absent until `goldLeft` reaches 0, then a ladder.
- Monk respawn points: when a level has `R` cells, a dead monk reappears at one of them
  (PRNG choice among free ones); without any, the current 1982 rule applies.

`tests/sim/terrain.test.ts`

- a runner on trapdoor turf falls through it; a monk too; digging it does nothing;
- crossing gooey turf takes `GOO_PERIOD` ticks per sub-unit for runners and monks;
- a hidden ladder is not climbable, not drawn, then climbable on the tick the last gold
  is taken;
- respawn uses an `R` cell, never an occupied one; with all occupied it waits; levels
  without `R` keep their replay hashes.

### B-023 — Teleporters

- Stepping fully into an entrance moves the actor to its linked exit on the next tick;
  exits do nothing when entered. Monks use them too (to confirm), the AI does not plan
  through them.
- Editor: placing `T` and `t` creates links (a new entrance links to the nearest exit);
  a "link" tool picks an entrance then an exit; links show as lines in the editor.

`tests/sim/teleport.test.ts`: entrance → exit; exit → nothing; an occupied exit (monk
standing on it) delays the jump; a chain (exit on an entrance) jumps once per tick.

`tests/editor/model.test.ts`: links follow cell edits (erasing an end removes the link);
undo restores links; `toLevel` output always validates.

### B-024 — Item slot, keys, doors and exit

- `src/sim/items.ts`: one item slot per player; "pick up" takes the item in the
  player's cell and leaves the held one there (swap, S-016 @ 3:03–3:05); with nothing to
  take, it drops the held item into an empty cell. Keys are the first items.
- A door is solid until a player **carrying** its key touches it; then it opens for good
  (S-016 @ 3:30–3:33). Whether the key is used up is to confirm (default: it is). Monks
  cannot take keys.
- The exit is not drawn and not there until the last gold is taken, then it appears
  (S-015 @ 1:22–1:23). An exit placed behind a door (a door on the exit cell) opens
  with its key once the gold is gone. This replaces step 1's always-visible locked door.

`tests/sim/items.test.ts`: pick up into an empty slot; pick up while holding swaps
the two items in place; drop needs an empty cell; items are never duplicated or lost
(randomized: 1,000 random levels and inputs keep the item count constant, so the 1994
duplication bug, S-005, is not reproduced).

`tests/sim/keys.test.ts`: a key opens only its colour, and only when carried to the
door; all doors of that colour stay closed until then; a door is support while closed
and empty once open; the exit is absent while gold is left, appears on the tick the last
gold is taken, and a door on the exit cell still needs its key.

### B-025 — Tools, part 1: slot, jackhammer, pickaxe

- `src/sim/tools.ts`: tools use B-024's slot; "use" applies the held tool.
- Jackhammer: the player rides it straight down, cell after cell (bedrock included),
  at about 5 tiles in 9 s (S-019 @ 2:33–2:43, to measure better); the shaft stays open
  behind for a while (monks can follow) and the tool stays in the slot. When the shaft
  refills is to confirm.
- Pickaxe: brings rubble down from the ceiling above the target cell; rubble falls
  (faster than monks) to the first support and blocks movement until it crumbles
  (`RUBBLE_TICKS`, provisional). Rubble on a monk freezes it in place (S-005, S-006).

`tests/sim/tools.test.ts`

- using an empty slot or a key does nothing;
- jackhammer digs bedrock and brick, not a ladder or a door;
- rubble falls to the first support, blocks runners and monks, then crumbles;
- randomized: the B-024 item-count check also covers tools.

### B-026 — Bombs

- Bombs lying in the level are collected by walking over them into a per-player
  counter (starts at 0 each level, S-015), and laid at the player's feet with the bomb
  key. A laid bomb burns for `FUSE_TICKS` (about 2.5 s, S-015 @ 1:05–1:07.5).
- Small bomb: opens a crater wider than a dug hole (shape to confirm); the destroyed
  blocks come back about 13 s later (S-015 @ 1:07.5–1:24); kills monks and players in
  it; bedrock is unharmed. A blast lights the bombs lying in its area, which explode a
  fuse later (chain reaction, S-015 @ 1:07.5–1:10.5).
- Big bomb: destroys every cell in its radius for good, bedrock included, except the
  exit; kills actors in it.

`tests/sim/bombs.test.ts`: collecting a bomb increments the counter, laying one
decrements it, laying with 0 does nothing; fuse timing; small crater cells and their
return; a blast lights the bombs in its area and each explodes one fuse later; bedrock survives
a small bomb and not a big one; the exit survives both; a player in range dies; two
bombs on one tick resolve in creation order.

### B-027 — Snare and gas

- Snare: dropped in a cell; the first monk (or player) to step on it hangs for
  `SNARE_TICKS`, then goes free and the snare is spent (to confirm).
- Gas: each use puts a cloud about 2 tiles wide in front of the player for `GAS_TICKS`
  (about 6 s); monks inside are stuck, then dazed for a moment (S-021 @ 0:54–1:04). The
  gun stays in the slot and can be used again right away. Monks on ladders or bars are
  immune (S-005, to confirm).

`tests/sim/snare-gas.test.ts`: a snared monk does not move or catch; a player can snare
itself; a cloud covers its cells for `GAS_TICKS` and every monk inside stops, not one on
a ladder or bar; two clouds can exist at once; a stuck monk does not catch a player
walking into it (to confirm); using the gun never empties the slot.

### B-028 — Goo bucket

- Using the bucket turns the floor cell in front of the player into gooey turf
  (temporary or permanent: to confirm).

`tests/sim/goo.test.ts`: goo is placed only on solid floor; it slows monks and players
like B-022's gooey turf; it does not block digging the cell under it (to confirm).

## Open questions (faithfulness)

For Guillaume (S-100 wins over every source), most important first:

1. **Two players, co-op:** does the level end when one player exits, or must both?
   What happens when one dies (both restart, or only that one)? The two-player clip
   (S-025) is a race; a co-op level would settle this.
2. ~~**Versus:** how is the winner decided?~~ First to their exit, after all the gold
   (S-025). Still open: in levels where the players share space, can one bury the other?
3. ~~**Bombs:** tools or counted separately?~~ Counted separately, and set off by a
   nearby blast (S-015). Still open: is the big bomb collected the same way?
4. **Jackhammer:** it stays in the slot after use (S-019). Still open: when does the
   shaft refill?
5. ~~**Keys:** opened when collected, or carried to the door?~~ Carried, in the item
   slot (S-016). Still open: is the key used up at the door?
6. **The "alcove"** element in the editor (S-001): what is it?
7. **Monk respawn points:** do monks also spawn from them over time, or only after
   dying?
8. **Not seen yet:** pickaxe in use, snare, goo bucket, teleporters, big bomb, a co-op
   level. These episodes were skimmed (tool-slot changes, 5-second contact sheets), not
   watched end to end, so some of these may be in them.
