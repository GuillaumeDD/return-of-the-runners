# Step 3 plan: TLR specifics (terrain, tools, two players)

Status: **approved** (PR #28). Roadmap: `docs/PRD.md` §7, step 3.
Backlog items: B-019 to B-029 (B-029 is a bug fix found in play), then B-038 (a fix found later), B-039 (the default level), B-040 and B-042 (fixes from Guillaume's playtest). Source ids (`S-…`) refer to [`../SOURCES.md`](../SOURCES.md).

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
Guillaume sent eleven episodes of the S-010 longplay and two two-player clips as files
(S-014 to S-026, PC version, 640 × 480). What they show is in the second table, with timestamps. The web
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

### Seen in the videos (S-014 to S-026)

Timestamps are positions in each episode file. Times were read at 2 frames per second,
so they are good to about half a second.

| Behavior                      | What the video shows                                                                                                                                                                                                                                     | Where                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Grid                          | The playfield is 28 tiles wide and 16 high (about 22 × 26 px per tile at 640 × 480), above a status bar                                                                                                                                                  | S-015 @ 0:30, S-014 @ 1:00      |
| Exit appears with the gold    | No exit is drawn while gold is left; a green door appears the moment the last gold is taken                                                                                                                                                              | S-015 @ 1:22–1:23, @ 3:05       |
| Exit behind a key door        | Level 104: the exit is a red door marked with an X; the runner brings the red key, the door turns into the green exit and the runner leaves                                                                                                              | S-016 @ 3:30–3:33               |
| Keys use the tool slot        | Picking up the key swaps it with the tool held: the status bar shows the key, and the old tool lies where the key was                                                                                                                                    | S-016 @ 3:03–3:05               |
| Bombs are a separate counter  | Bombs lying in the level are collected into a counter shown in the status bar (up to 4 seen), apart from the tool slot. The counter starts empty on each level                                                                                           | S-015 @ 0:01–0:20, @ 1:36–1:40  |
| Bomb fuse                     | A bomb laid by the runner burns for about 2.5 s, then explodes                                                                                                                                                                                           | S-015 @ 1:05–1:07.5             |
| Chain reaction                | The blast lights a bomb lying next to it, which explodes about 2.5 s later and lights the next one                                                                                                                                                       | S-015 @ 1:07.5–1:10.5           |
| Blasted terrain comes back    | Blocks destroyed by these bombs reappear about 13 s later, one after the other                                                                                                                                                                           | S-015 @ 1:07.5–1:24             |
| Lives                         | One extra life for each finished level, shown up to 99 (step 4: lives and scores)                                                                                                                                                                        | S-015 @ 1:32–1:36, S-016        |
| Hidden ladders and exits      | In the two-player level, two ladders and two exit doors appear in the middle the moment the gold is gone                                                                                                                                                 | S-025 @ 0:00–0:04               |
| Several exits                 | Level 91 shows two exit doors at once                                                                                                                                                                                                                    | S-020 @ 1:36                    |
| Held item kept between levels | The item in the slot is still there at the start of the next level                                                                                                                                                                                       | S-020 @ 1:36–1:39, @ 5:49–5:51  |
| Jackhammer                    | The runner rides it straight down through brick, about 5 tiles in 9 s; the shaft stays open behind (a monk follows it down); the tool stays in the slot                                                                                                  | S-019 @ 2:33–2:43               |
| Gas gun                       | Each use puts a green cloud about 2 tiles wide in front of the runner; it stays about 6 s and monks inside are stuck, then dazed; used twice in 3 s, kept                                                                                                | S-021 @ 0:54–1:04, S-023 @ 4:23 |
| Two players                   | One shared screen; a mirrored level with a wall in the middle, so each player has a half; no monks; separate scores, lives, tool slots and bomb counters                                                                                                 | S-025                           |
| Two-player race               | Both collect their gold, then dig and bomb their way to their own exit; the first one there wins (P1 reaches it first, the clip ends)                                                                                                                    | S-025 @ 0:04–1:24               |
| Two players, shared level     | Both players in one Ice World level with monks and tools; each has their own score (it counts their own gold), lives, slot and bombs; two exits appear when all the gold is gone. The clip stops before anyone leaves                                    | S-026 @ 0:00–4:20               |
| Pickaxe                       | Swung at a monk on the next cell, it brings a pile of rubble down onto it; the monk is buried and the pile is still there 7 s later; the pickaxe stays in the slot                                                                                       | S-021 @ 0:08–0:15.5             |
| Goo bucket                    | Used once on the floor in front of the runner, it leaves goo about 2–3 tiles wide that stays for the rest of the level; the bucket is used up (slot empty). A monk walking into goo gets stuck                                                           | S-022 @ 3:16–3:17, @ 3:36       |
| Teleporter                    | Each player steps into a teleporter in a bottom corner, vanishes, and appears next to their exit at the top about half a second to a second later                                                                                                        | S-025 @ 0:04–0:05               |
| Big bomb                      | Red blast (small bombs are yellow), round, about 5 cells across; laid from the same bomb counter (2 → 1 → 0), fuse about 2 s; a big bomb lying nearby is set off and blasts in turn; the destroyed terrain does not come back                            | S-025 @ 1:04–1:15, @ 0:24       |
| Snare                         | Laid on the floor (a golden arch); the first monk that walks in hangs in it, and is still held 22 s later; the monks behind walk past it; the runner later walks past the snared monk unharmed. A second snare taken from the level is laid the same way | S-018 @ 0:23–0:48               |
| Alcove                        | A dark arched niche; the runner hides in it for 17 s while monks walk right past and over it (one even falls onto it) without catching him                                                                                                               | S-018 @ 0:02–0:19, S-100        |

## Key design decisions

1. **Level format v2, one migration.** Every new element needs format support, so v2
   lands first and alone (B-019) with all the new tiles reserved, a v1 → v2 migration
   and fixtures for both versions. Later items only add behavior, never format. A v1
   file, link or stored level still opens (migrated on read); the app writes v2 only.
   _Update 2026-10-28: after B-019 merged, Guillaume dropped v1 reading (no player had
   used it). The migration, the v1 fixtures and their tests are gone; a v1 document is
   `unsupported-version`._
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
   | `n`  | alcove             |         |                          |

   The alcove (S-001) is a hiding place where monks cannot catch a player (S-018).

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

| Order | PR                  | Backlog | Visible result                                             |
| ----- | ------------------- | ------- | ---------------------------------------------------------- |
| 1     | Format v2           | B-019   | none (old levels still open; the editor saves v2)          |
| 2     | Two players: co-op  | B-020   | **two runners on one keyboard, same level**                |
| 3     | Two players: versus | B-021   | **race for the gold**, winner shown                        |
| 4     | Terrain             | B-022   | trapdoor, gooey turf, hidden ladder, alcove, monk respawns |
| 5     | Teleporters         | B-023   | teleporters, linked in the editor                          |
| 6     | Keys, doors, exit   | B-024   | the item slot; three key/door colours; exit appears        |
| 7     | Tools, part 1       | B-025   | **jackhammer** and **pickaxe** in the slot                 |
| 8     | Bombs               | B-026   | bomb counter; small and big bombs, chain reactions         |
| 9     | Snare and gas       | B-027   | ways to stop monks without digging                         |
| 10    | Goo bucket          | B-028   | spread goo to slow monks down                              |

Two players come early: playing together is the reason the project exists. B-018 (e2e
tests of the screens) and the B-029 fix stay independent and can land at any point.

Every UI string lands in EN and FR in the same PR, every visible change comes with a
screenshot, and every gameplay item adds at least one replay fixture (Node, Chromium,
Firefox, WebKit) and updates ARCHITECTURE § Observed behavior with its sources.

## Modules and enumerated tests

### B-019 — Level format v2 and migration

_Done; the v1 migration below was removed afterwards (see key design decision 1)._

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
  `TickInput = PlayerInput[]`; `src/sim/replay.ts`: replay v2 with one log per player
  (as built: v1 replays are not migrated but rewritten, since replays are test fixtures
  only); `src/input/keyboard.ts`: bindings per player.
- Co-op rules (S-100, Guillaume, 2026-10-27): the level is won when **one** player
  reaches the exit; a player who dies loses one of **their own** lives (each player has
  a count in the status bar, S-025, S-026) and only that player restarts at their start
  after `RESTART_DELAY_TICKS`, while the other keeps playing; with no life left, that
  player is out and the other plays on alone (S-100). Each player starts with 5 lives
  (S-026 @ 0:01). Defaults to confirm: gold is shared; the exit appears when all gold is
  taken; players do not block each other. Monks chase the nearest player.
- A level with a `Q` is offered in 1-player or 2-player mode; with one player, `Q` is
  ignored.

`tests/sim/players.test.ts`

- each player moves only with its own input; both can dig on the same tick;
- gold taken by either lowers `goldLeft`; the exit opens for both;
- one player reaching the open exit wins the level;
- a dead player loses one of their own lives and respawns at its start; the other's
  state (position, lives, score) is untouched; a player with no life left is out and
  the other plays on;
- two players can share a cell (no blocking) and a hole.

`tests/sim/ai.test.ts`: a monk picks the nearer player (cross-checked against the naive
reference on random two-player levels); ties go to P1.

`tests/sim/replay.test.ts`: the replays rewritten as v2 keep their tick and status (only
their hash changes); a two-player fixture reaches its committed hash in Node and the
three browsers.

`tests/input/keyboard.test.ts`: P1 and P2 default bindings share no key; each player's
keys produce only that player's input.

### B-021 — Two players: versus

_Done. As built: versus plays by the co-op rules (shared gold, any exit, deaths), so
the simulation and replays do not know the mode; `playersAtExit` names who got out, and
the session turns that into the winner or a draw. Dropping the carried item on death
comes with the item slot (B-024)._

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

_Done. As built: the alcove also hides the player from the monks' sight (they chase
another player or stand still; provisional), and a monk with every respawn point taken
waits `MONK_TICKS.respawn` before trying again. `GOO_PERIOD` is 6. Guillaume agreed to
both choices (monks' sight, goo speed) on 2026-10-29: not checked against the original._

- Trapdoor turf: drawn like brick, behaves as empty for support and digging (cannot be
  dug, since there is nothing there).
- Gooey turf: solid floor that cannot be dug; whoever walks on it moves at
  `GOO_PERIOD` (slower, provisional).
- Hidden ladder: invisible and absent until `goldLeft` reaches 0, then a ladder.
- Alcove (`n`): passable, no support of its own; a player whose centre is in it cannot
  be caught by monks (S-018 @ 0:02–0:19, S-100).
- Monk respawn points: when a level has `R` cells, a dead monk reappears at one of them
  (PRNG choice among free ones); without any, the current 1982 rule applies.

`tests/sim/terrain.test.ts`

- a runner on trapdoor turf falls through it; a monk too; digging it does nothing;
- crossing gooey turf takes `GOO_PERIOD` ticks per sub-unit for runners and monks;
- a hidden ladder is not climbable, not drawn, then climbable on the tick the last gold
  is taken;
- a monk walking through or landing on an alcove does not catch the player hiding in
  it; the same player one cell away is caught;
- respawn uses an `R` cell, never an occupied one; with all occupied it waits; levels
  without `R` keep their replay hashes.

### B-023 — Teleporters

_Done. As built: the jump is not on the next tick but after `TELEPORT_TICKS` (0.75 s),
the delay seen in S-025 @ 0:04–0:05; the actor waits at the exit, unseen and safe. A
chain cannot happen (an exit cell is never an entrance), so its test was dropped.
Monks use teleporters; the AI does not plan through them. The link tool is in the
palette, after the tiles. Guillaume agreed (2026-10-29) to the delay and to monks
chasing a player in transit._

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

_Done. As built: a new pick-up key (C alone; comma and R with two players) picks up,
swaps or drops, once per press. A key opens the first door of its colour next to the
player and is used up (provisional). A door cannot share the exit's cell in the level
format (one tile per cell), so "a door on the exit cell" became an exit walled in by a
door, and its test checks that. A player who dies keeps its item. Guillaume agreed
(2026-10-29) to these three choices._

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

_Done. As built: a new use key (V alone; M and F with two players) acts once per
press (the jackhammer: while held, since B-040). The jackhammer drills brick and bedrock, 100 ticks a cell (provisional), and
each drilled cell is an ordinary hole, so the shaft refills behind and kills whoever
stays in it. Pickaxe rubble falls one sub-unit a tick, lands solid like bedrock and
crumbles after 420 ticks; while it falls it crushes monks and also players
(provisional). Tools are never used up. Guillaume agreed (2026-10-29) to rubble
crushing players, the jackhammer drilling bedrock, and rubble never sealing gold, an
item or the exit._

- `src/sim/tools.ts`: tools use B-024's slot; "use" applies the held tool.
- Jackhammer: the player rides it straight down, cell after cell (bedrock included),
  at about 5 tiles in 9 s (S-019 @ 2:33–2:43, to measure better); the shaft stays open
  behind for a while (monks can follow) and the tool stays in the slot. When the shaft
  refills is to confirm.
- Pickaxe: swung at the next cell, it brings rubble down there; rubble falls (faster
  than monks) to the first support and blocks movement until it crumbles
  (`RUBBLE_TICKS`, provisional, at least 7 s, S-021 @ 0:08–0:15.5). Rubble on a monk
  buries it in place (S-021, S-005, S-006). The pickaxe stays in the slot.

`tests/sim/tools.test.ts`

- using an empty slot or a key does nothing;
- jackhammer digs bedrock and brick, not a ladder or a door;
- rubble falls to the first support, blocks runners and monks, then crumbles;
- randomized: the B-024 item-count check also covers tools.

### B-026 — Bombs

_Done. As built: a new bomb key (B alone; N and G with two players). One counter per
player holds both kinds, laid in pick-up order (agreed by Guillaume, 2026-10-29). Small
blast: its row ± 2 cells and the rows above and below ± 1, brick only, back after
13 s; big blast: dx² + dy² ≤ 5, all terrain for good except the exit, gold, items and
teleporters. Shapes are provisional. Blasts kill actors whose centre is in them and
light bombs lying there; the counter shows in the status line._

- Bombs lying in the level are collected by walking over them into a per-player
  counter (starts at 0 each level, S-015), and laid at the player's feet with the bomb
  key. A laid bomb burns for `FUSE_TICKS` (about 2.5 s, S-015 @ 1:05–1:07.5).
- Small bomb: opens a crater wider than a dug hole (shape to confirm); the destroyed
  blocks come back about 13 s later (S-015 @ 1:07.5–1:24); kills monks and players in
  it; bedrock is unharmed. A blast lights the bombs lying in its area, which explode a
  fuse later (chain reaction, S-015 @ 1:07.5–1:10.5).
- Big bomb: laid from the same counter (S-025 @ 1:04–1:12); a round blast about 5 cells
  across (radius to measure) destroys every cell in it for good, bedrock included,
  except the exit (S-002), and kills actors in it. It also sets off bombs lying in its
  area (S-025 @ 1:10–1:12).

`tests/sim/bombs.test.ts`: collecting a bomb increments the counter, laying one
decrements it, laying with 0 does nothing; fuse timing; small crater cells and their
return; a blast lights the bombs in its area and each explodes one fuse later; bedrock survives
a small bomb and not a big one; the exit survives both; a player in range dies; two
bombs on one tick resolve in creation order.

### B-027 — Snare and gas

- Snare: an item, laid in the player's cell (an empty one) and used up; the first monk
  to walk into it hangs there, harmless, for the rest of the level (S-018 @ 0:22–0:48,
  S-100); other monks walk past it. Only its death frees it (a blast, rubble, a refilled
  hole). A player is never caught: players walk over snares (Guillaume, 2026-10-30,
  S-100).
- Gas: each use puts a cloud about 3 cells wide in front of the player for `GAS_TICKS`
  (6.5 s); every monk inside is stuck, then dazed for 2.5 s more (S-021 @ 0:53–1:05).
  The gun stays in the slot and can be used again once the player is free. Monks on
  ladders or bars are immune (S-005, to confirm).

Done (2026-10-29), measured on S-018 and S-021 at 2 frames per second.

`tests/sim/snare-gas.test.ts`:

- snare: picked up and swapped like any item; laid in the player's (empty) cell, which
  empties the slot; not while falling, not twice in a cell, not on a ladder, a bar or
  gold; the first monk walking in hangs there, aligned, and is still held 3000 ticks
  later; other monks walk past it; it catches nobody and is no body; the runner walks
  over an armed snare; a blast kills a snared monk, which reappears free; a monk
  snared with gold drops it; a snared monk blocks neither a start nor a teleporter
  exit;
- gas: a cloud over the 3 cells in front for `GAS_TICKS`, the way the player faces,
  stopping at a wall; the gun is kept and fires again, two clouds at once; a monk
  walking in stops, dazed, and does not catch the runner walking through; it stays
  dazed `DAZE_TICKS` after the cloud, then chases again; not on a ladder or a bar; a
  dazed monk still falls, and is trapped in a hole it falls into.

`tests/fixtures/replays/snare-gas.json`: a snare and two clouds, then the runner wins.

### B-028 — Goo bucket

_Done._

- `src/sim/goo.ts`: the use key throws the bucket's goo; the floor under the 3 cells in
  front of the player (`GOO_CELLS`) becomes gooey turf for the rest of the level, and
  the bucket is used up (S-022 @ 3:16–3:17). A monk walking into goo is slowed to
  `GOO_PERIOD`, which reads as stuck (S-022 @ 3:19–3:36). The goo stops at a wall, a
  gap, a ladder, a door, a hole, a crater or rubble, and is not thrown from a bar
  (provisional). Bucket goo is gooey turf, so it cannot be dug, cratered by a small
  bomb or drilled (provisional; the plan had left digging open).
- Drawing: the bucket in a cell and in the player's hand; the editor palette and the
  tile name (EN + FR).

`tests/sim/goo.test.ts`

- picked up and swapped like any item;
- the floor under the 3 cells in front turns to goo, the bucket is used up, the player
  is busy `GOO_THROW_TICKS`, its own floor is untouched; thrown the way it faces;
- bedrock and goo are covered too; the goo stays for the rest of the level;
- stops at a wall or the level's edge; at a gap, a ladder or a door under the cell; at
  a hole, even one still being dug, which it does not fill; at a crater and at landed
  rubble;
- kept when nothing can take goo (against a wall), while falling, on a bar, or while
  busy digging; nothing with an empty slot; one throw per press;
- the runner walks on it at `GOO_PERIOD`; a monk crossing it is far slower than on
  brick; it cannot be dug.

`tests/render/grid.test.ts`: the bucket is drawn in a cell (game and editor) and in
the player's hand. `tests/editor/keys.test.ts`: the palette holds the bucket.

`tests/fixtures/replays/goo.json`: the runner throws goo in front of a monk, fetches the
gold and climbs away; `replay.test.ts` checks that with the same inputs and no bucket
the monk catches the runner.

### B-029 — Fix: a runner on a hole holds the monk in it

- Found in play by Guillaume (S-100, 2026-10-28): a monk trapped in a hole climbed out
  into the runner standing on its head, and caught it. In TLR the runner on top holds
  the monk down: it cannot climb while the runner is in the cell above, and dies if the
  hole refills meanwhile.
- `src/sim/monks.ts` (`escape`): no climbing step while the runner overlaps the cell
  above the hole. With two players (B-020), any player holds the monk.

`tests/sim/monk.test.ts`

- a runner standing on the hole keeps the monk in place and alive until the hole
  refills, then the monk dies and the runner is unharmed;
- once the runner steps off, the held monk climbs out and leaves.

### B-038 — Fix: a monk stops at the edge of a pit

- Found while testing the new default level (2026-10-29): a monk whose way to the
  runner was down a one-cell pit, or through trapdoor turf, stopped at the edge and
  never moved again. The AI picks "down" from the monk's centre column, but the shared
  movement rules only move an actor off its grid line toward a ladder or a bar, so the
  monk, still half on the floor, neither moved nor fell.
- `src/sim/monks.ts` (`toColumn`): a monk told to go down, not aligned on that column
  and with no ladder or bar there, walks to the column instead; once there, it falls.
  The AI itself (`ai.ts`) is unchanged.
- The `terrain` replay depended on the bug (its monk stood at the edge of the hidden
  ladder's shaft): re-recorded so the runner still traps it and it still reappears at
  the respawn point.

`tests/sim/monk.test.ts`

- a monk walks to the column of a pit and drops through it to the runner below, coming
  from the right and from the left;
- the same through trapdoor turf.

### B-039 — The default level shows step 3

- Asked by Guillaume (2026-10-29): the level the game opens on (`src/levels/first-steps.json`,
  the only bundled level) should show the new features. Rebuilt on three floors with
  trapdoor turf, gooey turf, a hidden ladder, alcoves, a teleporter, a red key and door,
  the jackhammer (a pocket of gold under bedrock), the pickaxe, small and big bombs, a
  monk respawn point, diggable brick, and a player 2 start. One monk.
- To update again at the end of step 3, with the snare, gas and goo bucket (B-027,
  B-028).

Tests:

- `tests/fixtures/replays/default-level.json`: one player wins the level with its monk in
  play (bomb, door, a held monk, jackhammer, teleporter, hidden ladder);
- `tests/levels/bundled.test.ts`: that replay's level is the bundled level, so the
  bundled level stays winnable;
- `tests/level/file.test.ts`: the "no `teleports` field" export check uses a fixture
  without teleporters, since the bundled level now has one.

### B-040 — Fix: the jackhammer drills only while the key is held

- Found by Guillaume in play (2026-10-30): one press of the use key drilled all the way
  down. He wants the jackhammer active only while the key is held.
- `src/sim/step.ts`: the jackhammer starts whenever the use key is held (not only on a
  press) and the player is free, so a player holding it drills again each time it lands;
  letting go while a cell is being drilled drops that cell's hole (it stays solid) and
  frees the player at once. `Player.drill` now only marks a cell being drilled;
  `keepDrilling` is gone.
- The `tools` and `default-level` replays now hold the key while drilling; both end on
  the same tick, status and hash as before.

`tests/sim/tools.test.ts`

- held, the jackhammer drills brick then bedrock and stops on a ladder;
- let go mid-cell: no hole, the brick is whole, the player walks off;
- let go once a cell opened: the player falls in and drills no further; held again, it
  goes on;
- held while walking: it drills once the player is over a drillable cell;
- dropping the jackhammer while holding the key stops the drill.

### B-042 — Fix: the pickaxe needs a ceiling

- Found by Guillaume in play (2026-10-30): the pickaxe worked anywhere. The rubble comes
  out of the ceiling, so it now needs one.
- `src/sim/tools.ts`: a swing does nothing unless the cell above the target is solid
  (`tileAt`, so landed rubble counts and a dug or blown-open cell does not; above the
  top row reads as bedrock, so the top of the level counts).
- The `tools` replay level gets a bedrock block above the swing; same tick and status,
  new hash (the level changed).

`tests/sim/tools.test.ts`

- under open air nothing happens (no rubble, not busy); under brick, bedrock or the
  level's top, rubble comes down; under a dug-open brick, nothing.

## Open questions (faithfulness)

For Guillaume (S-100 wins over every source), most important first:

1. ~~**Co-op:** level end, and what happens on a death?~~ The level ends when one player
   exits; a dead player alone restarts, using one of their own lives; with no life
   left, that player is out and the other plays on (S-100).
2. ~~**Versus:** how is the winner decided?~~ First to their exit, after all the gold
   (S-025). Still open: in levels where the players share space, can one bury the other?
3. ~~**Bombs:** tools or counted separately?~~ Counted separately, and set off by a
   nearby blast (S-015); big bombs use the same counter (S-025).
4. **Jackhammer:** it stays in the slot after use (S-019). Still open: when does the
   shaft refill?
5. ~~**Keys:** opened when collected, or carried to the door?~~ Carried, in the item
   slot (S-016). Still open: is the key used up at the door?
6. ~~**The "alcove"**: what is it?~~ A hiding place: a player inside cannot be caught
   (S-018 @ 0:02–0:19, S-100). Still open: can a player act (dig, use a tool) from it?
7. **Monk respawn points:** do monks also spawn from them over time, or only after
   dying?
8. ~~**Snare:** does a snared monk get free?~~ No, it stays caught (S-100); a bomb
   blast is the guessed exception.
9. Every TLR element listed by S-001 has now been seen in a video.
