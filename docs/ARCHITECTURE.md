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
              src/game/          fixed-timestep loop, play session, status line
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

Code: `src/sim/`. Entry points: `createState(level, seed, players)` (one or two
players) and `step(state, inputs) → state` (one `PlayerInput` per player).

- **Pure and deterministic.** Fixed timestep (`TICKS_PER_SECOND = 60`), integer ticks,
  integer positions, seeded PRNG (`prng.ts`, mulberry32, state stored in `GameState`).
  It never touches the DOM, wall-clock time, audio or `Math.random`.
- **Plain-data state** (`state.ts`): no classes or closures, never mutated, so it can be
  hashed (`hash.ts`, FNV-1a over a canonical field order) and compared in tests.
- **Data flow:** input is fed to the simulation as per-tick commands; rendering only
  reads its state. This makes gameplay unit-testable and replayable.
- **Engine-independent:** no transcendental `Math` functions, no reliance on the
  iteration order of objects keyed by numeric-looking strings.
- **Replays** (`replay.ts`, format version 2): a level, a seed and one run-length
  encoded input log per player (`[ticks, keys]`, keys in the canonical order `LRUD<>IXB`, `I` being pick up, `X` use and `B` bomb,
  `""` for no input; one or two logs, all covering the same number of ticks) rebuild
  the exact same game. Version 1 (a single log) is no longer read: replays are test
  fixtures only, and those were rewritten. `runReplay` returns the final state and a checkpoint hash every
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
  new values). A new state field also changes every hash while tick and status stay
  the same (B-023 added `teleports` and `warp`, B-025 `rubble`, `useHeld` and
  `drill`, B-026 `craters`, `fuses`, `blasts`, `bombs` and `bombHeld`); say so in the PR
  as well.

### Movement model

- Positions are in **sub-units**: one tile is `SUB = 8` sub-units on each axis. An actor
  is aligned on an axis when its position there is a multiple of `SUB`.
- An actor is between two tiles on at most one axis at a time. To change axis (turn
  onto a ladder, step off one), it first **snaps** toward the nearest aligned position.
- **Support** (`physics.ts`): an aligned actor is held up by a ladder or bar in its own
  cell, or by brick, bedrock, gooey turf, a closed door, landed rubble, a ladder or the
  level floor below it. Otherwise it falls,
  and input is ignored until it lands or catches a bar.
- **Up** needs a ladder in the current cell; **down** works onto or along a ladder, and
  lets go of a bar. Moving along a bar usually stops between two columns: down then
  snaps the actor onto the nearest column (up to half a tile) and it drops from there. Vertical input wins when it can move; otherwise horizontal applies.
  There is no jump.
- Outside the level reads as bedrock (walls and ceiling); the bottom row stands on the
  level floor.
- Speeds are periods: an actor moves one sub-unit every `RUNNER_PERIOD.*` ticks.

### Terrain

- `physics.ts`, `actorTile`: trapdoor turf (`%`), a hidden ladder not yet revealed
  (`h`), an alcove (`n`) and a monk respawn point (`R`) read as **empty** for movement,
  support and digging (so trapdoor turf cannot be dug, and the brick under it can). The
  chase AI reads them the same way.
- **Trapdoor turf** is drawn exactly like brick in the game; the editor adds a mark.
- **Gooey turf** (`~`) is solid floor that cannot be dug. Whoever walks on it (the cell
  below its centre column) moves one sub-unit every `GOO_PERIOD` ticks, runners and
  monks alike.
- **Hidden ladders** stay `h` in `tiles` (not drawn) until `goldLeft` reaches 0; on that
  tick, after the players collect gold, `revealLadders` turns every `h` into a ladder
  (`H`). A level without gold starts with them revealed.
- **Alcove**: a player whose centre is in one is hidden: monks neither catch it nor see
  it (`monks.ts`, `isHidden`), so with no other player in sight they stand still.
- **Monk respawn points** (`R`): not drawn in the game. See Monks.

### Teleporters

- `teleport.ts`: one-way links from an entrance (`T`) to an exit (`t`), from the
  level's `teleports` (kept in `GameState`, and hashed). Both read as **empty** for
  movement, support and digging.
- An actor (player or free monk) **aligned** on an entrance, after its move, is moved
  to the linked exit at once and is **in transit** for `TELEPORT_TICKS` (45 ticks,
  0.75 s): `warp` counts down; it does not move, take gold, catch or get caught. Monks
  still see a player in transit, at its exit, and chase it there (so they do not stop
  while it travels). It is drawn as a sparkle on the exit. Falling onto an entrance
  counts. An exit does nothing when entered.
- A monk in play standing on the exit, even partly, **delays** the jump: an actor that
  stays on the entrance jumps once the monk has left (one that walks on just crosses
  it). A monk in transit on the exit blocks too, and walking monks do not step onto it,
  so two monks never come out on top of each other; a dead monk does not block.
- The chase AI does not plan through teleporters; a monk only uses one when its chase
  walks it onto an entrance.

### Items, keys and doors

- `items.ts`: items lie in cells of `tiles` (keys `a b c`, tools `j k`, the snare `s` and
  the gas gun `g`) and read as
  **empty** for movement, support and digging, so a brick can be dug under one, as
  under gold. Monks never take them.
- Each player has one **item slot** (`Player.item`, `""` when empty). The pick-up key
  (`PlayerInput.pickUp`) acts on the tick it is pressed (`Player.pickHeld` remembers
  last tick), at the player's centre cell: on an item, the player takes it and leaves
  the one it held there (a swap, S-016 @ 3:03–3:05); on an empty cell (`.` only, not a
  ladder, bar, gold or exit), it drops the held item. Not while digging, in transit or
  dead. A player who dies keeps its item.
- **Doors** `A B C` are solid like bedrock (walls and floor) and cannot be dug. A
  player in play holding the key of a door's colour, with the door next to its centre
  cell (left, right, above or below, in that order; not diagonally), opens it: the
  door becomes empty for good and the key is used up, so a key opens one door
  (S-016 @ 3:30–3:33; used up: agreed by Guillaume, 2026-10-29). Every tick, after the pick-up.
- A door cannot sit on the exit cell (one tile per cell): to keep the exit shut until
  a key is brought, the maker walls it in with doors.

### Tools

- `tools.ts`: the jackhammer `j` and the pickaxe `k` are items (see above), used from
  the slot with the use key (`PlayerInput.use`), once per press (`Player.useHeld`).
  Using an empty slot or a key does nothing; nothing works while falling, busy, in
  transit or dead, nor from a spot where snapping to the nearest cell would leave the
  player falling (as for digging). Tools are never used up (S-019, S-021).
- **Jackhammer** (S-019 @ 2:28–2:43): the player snaps onto its nearest cell and drills
  the cell below if it is brick or bedrock, inside the level, not already dug, and no
  monk is in it (a ladder, a door, gooey turf or an empty cell stop it). The drilled
  cell is an ordinary hole that starts at a negative age, so it stays solid for
  `DRILL_TICKS` (100) instead of `HOLE_TICKS.digging` while the player waits
  (busy); then it opens, the player falls in, and `Player.drill` makes it drill the
  next cell on landing, until it cannot or no longer holds the jackhammer. The shaft refills behind like any hole, bedrock
  included, and kills whoever is still in a cell when it fills; monks can fall into it
  and are trapped as in a dug hole.
- **Pickaxe** (S-021 @ 0:06–0:15): the cell in front of the player (`facing`) must be
  empty (`.`) or an open hole, with no rubble, and **under a ceiling**: the cell above
  it solid (brick, bedrock, gooey turf, a door or landed rubble; the top of the level
  counts, a dug or blown-open cell does not; Guillaume, 2026-10-30). Rubble (`GameState.rubble`: column,
  height in sub-units, ticks since landing or -1) appears there and the player is busy
  `PICK_TICKS`. Rubble falls one sub-unit a tick (as fast as a falling runner, faster
  than monks) until a solid tile, a ladder, landed rubble or the level floor holds it
  up, then lands; pieces are moved lowest first, so one falling on another that lands
  stacks on it. Rubble that comes to rest in any other cell (gold, an item, the exit, a
  teleporter…) crumbles at once rather than seal it (agreed by Guillaume, 2026-10-29). Landed rubble reads as **bedrock**
  for movement, support, digging and the chase AI; monks neither reappear nor drop
  gold in a rubble cell. It falls again if a hole opens under it, and crumbles
  `RUBBLE_TICKS` (420, 7 s) after landing, or at once when its cell turns back into
  brick or bedrock (a refilled hole).
- **Crushing**: rubble that is falling, or lands this tick, kills every monk and player
  in play that it touches (their boxes overlap), after the holes age, so a monk right
  in front of the swing is buried at once (S-021 @ 0:08). A crushed monk is dead as if
  buried (it keeps its gold); a crushed player dies as if caught (agreed by Guillaume, 2026-10-29).

### Snares and gas

- `snares.ts`: the snare `s` is an item. The use key lays it, armed, in the player's
  cell (`GameState.snares`) if that cell is empty (`.`: not a ladder, a bar, gold or an
  item; not while falling, nor where one is already armed), which empties the slot. The first monk whose centre enters that cell is `snared`: aligned
  on the cell, it hangs there for good (S-018 @ 0:22–0:48; S-100), moves no more and
  catches nobody, and it is **not a body** (`monkAt`): players and other monks pass it
  (S-018 @ 0:30). The snare is used up. Only death frees it (a blast, rubble, a hole
  refilling on it), and it then reappears free like any dead monk. A monk caught with
  gold drops it in the snare's cell, or the cell above, whichever is empty. A snared
  monk blocks neither a player's start nor a teleporter's exit. Players walk over
  armed snares unharmed: players are never caught (S-100).
- `gas.ts`: the gas gun `g` is an item, never used up. The use key fires a **cloud**
  (`GameState.clouds`: first cell, row, width, ticks left) over the `GAS_CELLS` (3)
  cells in front of the player, on its row, stopping at the first solid cell (none
  against a wall); it lasts `GAS_TICKS` (390, 6.5 s) and the player is busy
  `GAS_FIRE_TICKS`. Several clouds can be out at once (S-021 @ 0:58).
- A free monk whose centre is in a cloud, after its move, is `dazed`: it stands still
  (it still falls if nothing holds it up), catches nobody and is still a body, so the
  monks behind it queue up (S-021 @ 0:55–1:00). A dazed monk that falls into a hole is
  trapped as a free one would be. Its daze restarts at `DAZE_TICKS`
  (150, 2.5 s) every tick it is in a cloud, so it wears off 2.5 s after the cloud is
  gone (S-021 @ 1:01–1:03.5). A monk on a ladder or a bar, or falling, is not affected
  (S-005); nor is a monk trapped in or climbing out of a hole. Players pass through
  clouds unharmed (S-021 @ 0:58–1:00).
- Order in a tick: a player lays the snare or fires as it uses a tool; then each monk,
  after its move, may walk into a snare or be dazed; the clouds then thin out, after
  the monks and before the holes age.

### Goo bucket

- `goo.ts`: the goo bucket `u` is an item, used up on its first throw. The use key
  (not while falling or busy) throws the goo along the player's row: the floor under
  each of the `GOO_CELLS` (3) cells in front turns into **gooey turf** `~` in `tiles`,
  for the rest of the level (S-022 @ 3:16–3:17, where it spreads over about half a
  second; here it appears at once). The player snaps onto its cell and is busy
  `GOO_THROW_TICKS` (45, 0.75 s).
- The player must not hang on a bar (S-022 only shows a throw from a floor). The goo
  runs outward from the cell next to the player and stops at the first cell an
  actor cannot stand in (a wall, the level's edge), or whose floor is not intact brick,
  bedrock or goo: a gap, a ladder, a door, a hole (even one still being dug), a crater
  or rubble. When not even the first cell can take goo, nothing happens and the bucket
  is kept. These limits are provisional: S-022 only shows goo thrown on a plain floor.
- The goo is ordinary gooey turf (see Terrain): runners and monks walk on it at
  `GOO_PERIOD`, which is how a monk "gets stuck" in it (S-022 @ 3:19–3:36). The brick
  or bedrock under it is gone: the goo cannot be dug, cratered by a small bomb or
  drilled with the jackhammer (provisional), and a big blast destroys it.

### Bombs

- `bombs.ts`: small bombs `o` and big bombs `O` lie in cells of `tiles` and read as
  **empty** for movement, support and digging. A player in play whose centre enters
  one picks it up into its **bomb counter** (`Player.bombs`, one tile per bomb in
  pick-up order; empty at the start of each level, S-015; kept when the player dies).
  Monks walk past bombs. The status line shows the counter (alone: only while it is
  not empty).
- The bomb key (`PlayerInput.bomb`, once per press, `Player.bombHeld`) lays the
  **first bomb picked up**, lit, in the player's centre cell (`GameState.fuses`); not
  while falling or busy, nor where a bomb already lies or burns. It explodes
  `FUSE_TICKS` (150, 2.5 s, S-015 @ 1:05–1:07.5) later. Lit bombs are passable and do
  not fall.
- **Small blast** (`blastCells`): the bomb's row two cells either side, and one cell
  either side in the rows above and below (11 cells; a bomb two cells away is lit,
  S-015 @ 1:07.5). Brick in it is blown away into a **crater** (`GameState.craters`)
  for `CRATER_TICKS` (780, 13 s, S-015 @ 1:07.5–1:21): `tileAt` reads it as empty,
  then the brick comes back over the last `HOLE_TICKS.closing` ticks (drawn like a
  closing hole) and whoever is in it then dies, as in a refilled hole. Bedrock and all
  other tiles are unharmed. A hole in a blasted brick is gone.
- **Big blast**: the cells with `dx² + dy² ≤ 5` (21 cells, about five across, S-025 @
  1:04–1:15). The terrain in it (brick, bedrock, goo, trapdoor turf, ladders, hidden
  ladders, bars, alcoves, doors) is destroyed **for good** (`tiles`), with any hole or
  crater there; the exit, gold, items, teleporters and respawn points are spared.
- Every blast kills each monk and player in play whose centre cell is in it (a monk as
  if buried, keeping its gold), clears the rubble in it, and **lights the bombs lying
  in it**: each explodes a fuse later (a chain reaction, S-015 @ 1:07.5–1:12); a bomb
  already burning keeps its fuse. Bombs
  whose fuse runs out on the same tick explode in the order they were lit. Order in a
  tick: after the holes age, before the rubble falls. A blast is drawn for
  `BLAST_TICKS` (`GameState.blasts`).
- The chase AI ignores craters, as it ignores holes; it sees what a big blast
  destroyed. Monks do not drop gold over a crater.

### Digging and holes

- `holes.ts`: a hole is `{ cx, cy, age }`, kept in `GameState.holes` in creation order.
  Its phase comes from its age only: **digging** (still solid), **open**, **closing**
  (both passable), then it is removed and the brick is back (`HOLE_TICKS`).
- `tileAt()` reads an open or closing hole as empty, so movement, falling and support
  need no special case for holes.
- **Digging** (`step.ts`, `tryDig`): exactly one dig key, the player not falling (on
  the ground, on a ladder or hanging on a bar), the target diagonally below its nearest
  cell an undug brick, and the cell above the target empty (an item or the exit count
  as empty) or holding gold (a brick,
  ladder or bar blocks; the gold stays in place; another player does not block). Walking or climbing usually stops between two tiles, so the player snaps onto
  the nearest cell (up to half a tile), turns that way and is busy (frozen) while the
  hole is dug.
- Order within a tick: the players act (dig or move), holes age, then a player whose
  box overlaps a hole that just filled dies (see Players for what a death does). A
  lost or won state only counts ticks; `game/session.ts` restarts the level
  `RESTART_DELAY_TICKS` later.
- **All tunable values live in `src/sim/rules.ts`** and are provisional until checked
  against the original (see the table below).

### Gold and exit

- `GameState.goldLeft` counts the gold no player has collected yet (gold carried by
  monks included); it is shared by both players, and each player also counts the gold
  it took (`Player.gold`). It starts at the number of `$` tiles (`gold.ts`).
- An actor **touches** a cell once its centre is inside it (`centerCell`), so it need
  not be aligned. A player collects the gold it touches, which removes it from
  `tiles`, also while falling. Gold is neither solid nor support.
- The exit (`E`) is not there while `goldLeft > 0`: not drawn, and passable with no
  support like an empty cell. It appears on the tick the last gold is taken
  (S-015 @ 1:22–1:23); doors around it can keep it shut (see Items, keys and doors).
  A player in play touching it once the last gold is taken sets the status to `won`
  (for both players), which freezes the state like `dead`, and takes precedence over a
  hole filling on the same tick: nobody dies on the winning tick. `playersAtExit` names the players touching the open
  exit, so on a won state it names who got out: one player, or both on the same tick.
  Exits belong to no player.
- Order within a tick: each player acts (dig or move), picks up or drops an item,
  opens a door and collects gold, then the exit
  is checked, holes age, and deaths are counted. `game/session.ts` restarts the level after a win, since there is
  only one level until packs exist.

### Players

- `GameState.players`: player 1 from the `P` marker, then player 2 from `Q` in a
  two-player game (`createState(level, seed, 2)`; with one player a `Q` is an empty
  cell). This order is the update order. Each player is an actor plus `mode`
  (`alive`, `dead` waiting `timer` ticks, or `out`), `lives` (`START_LIVES`), `gold`
  and its start position.
- Players never block each other: they share cells and holes, are not floor for each
  other, and do not stop each other's digs.
- **A death** (caught or buried) costs the player one of its own lives; at 0 it is
  `out` for the rest of the level. With one player, a death ends the level (status
  `dead`; the session restarts it). With two (co-op, S-100): the dead player waits
  `PLAYER_RESPAWN_TICKS`, then reappears at its start (later, while a monk overlaps that
  cell) while the other keeps playing; the level is lost only once both are `out`, and
  won as soon as one player reaches the open exit.
- **Modes** (`game/session.ts`, `PlayMode`): `solo`, `coop` or `versus`. Both
  two-player modes play by the same rules above (shared gold, any exit, holes bury
  either player, so a player can trap the other in a hole it digs); only the ending
  differs. In co-op the level is complete; in versus the player `playersAtExit` names
  wins, and both on the same tick is a draw (`game/hud.ts`, `statusMessage`). The
  simulation never sees the mode, so replays do not record it.
- Per-player lives, gold and bombs show in a status line under a two-player game
  (`game/hud.ts`); alone, the line shows only the bombs carried. Lives across levels
  and scores come with level packs (step 4).

### Monks

- `GameState.monks`, created from the `M` markers in reading order, which is also the
  update order. They move with the players' rules (`move.ts`, shared) at their own,
  slower speed (`MONK_PERIOD`). A monk's body is floor: players and other monks can
  stand on it (`physics.ts`, `monkAt`). Monks never overlap: a move into another monk
  is cancelled.
- **Target** (`monks.ts`, `targetOf`): each tick, a monk chases the nearest player in
  play and in sight, not hiding in an alcove (`|dx| + |dy|` in sub-units; a tie goes to
  player 1). With none (waiting to reappear, or hiding) it stands still. Below, "the runner" is that player.
- **Chase AI** (`ai.ts`): the classic 1982 algorithm, reimplemented. Same row and a
  walkable floor between them: go straight at the runner. Otherwise scan the monk's
  floor up to the walls and edges; from each column, see where falling or a ladder
  would lead, and rate it: the runner's row (nearest column first), then above it, then
  below it. The AI reads static tiles, so a hole looks like brick and monks walk into
  it. Like the original, the same-row check ignores walls: a monk on the runner's row
  presses against a wall rather than going around it. A randomized test checks the AI
  against a naive reference implementation. When the AI says "down" from a column with
  no ladder or bar (a pit, trapdoor turf), a monk not yet on that column walks to it,
  then falls (`monks.ts`, `toColumn`; B-038).
- **Holes** (`monks.ts`): a monk aligned in an open hole is `trapped` for
  `MONK_TICKS.trapped`, then `escaping`: it climbs to the row above and walks off
  sideways, without falling back in (walled in on both sides, it falls back in). It
  cannot climb while the runner stands in the cell above the hole (S-100). If the hole refills on it, it is `dead` for
  `MONK_TICKS.respawn`, then reappears: at a monk respawn point (`R`) drawn by the PRNG
  among those free of monks and players in play (all taken: it waits another
  `MONK_TICKS.respawn`); in a level without one, on the second row from a PRNG-chosen
  column (the first empty cell from there, wrapping, else the next row down).
- **Gold**: a monk with nothing picks up the gold it touches and carries it for
  `MONK_CARRY.min` plus a PRNG draw in `[0, MONK_CARRY.spread)` cells, then drops it on
  the next free floor cell; it waits one cell before picking gold up again. A trapped
  monk drops its gold on top of the hole and waits two cells, so it does not take it
  back while climbing out. Carried gold still counts in `goldLeft`.
- **Catching**: a monk whose centre cell is a player's catches that player (any player
  in play, not only its target); a snared or dazed monk catches nobody. A monk
  standing over a dig target blocks the dig.
  A dead monk never reappears on a player's cell.
- Order within a tick: players, gold and exit as above, then each monk in order (move,
  gold, snare, trap, teleporter, gas, catch), then the clouds thin out, then holes age
  and kill whoever they fill.

## Game loop, input and rendering

- `requestAnimationFrame` drives the loop; `advance()` turns elapsed time into whole
  ticks using integer millionths of a tick (no drift at any refresh rate) and caps a
  frame at 250 ms, so a background tab does not trigger a burst of catch-up ticks.
- Input is sampled once per frame and applied to every tick of that frame. Keys are
  bound by `KeyboardEvent.code` (physical position, so AZERTY works). Held keys are
  cleared on window blur, since a key released while unfocused never fires `keyup`.
- **Two players on one keyboard** (`input/keyboard.ts`): alone, the player uses the
  arrows, Z / X to dig (W / X on AZERTY), C to pick up, V to use a tool and B to lay
  a bomb. With two, player 1 (right) uses the arrows, the two keys left of right Shift
  to dig (`Period`, `Slash`), the one before them to pick up (`Comma`, ; on AZERTY),
  the one before that to use a tool (`KeyM`, , on AZERTY) and `N` to lay a bomb;
  player 2 (left) `W A S D`, `Q` / `E` to dig, `R` to pick up, `F` to use a tool and
  `G` to lay a bomb (Z Q S D and A / E on AZERTY); the two sets share no key. Remapping and
  gamepads: step 4.
- A level with a `Q` shows a "1 player / 2 players: co-op / 2 players: versus" choice
  above the play and test canvases; switching restarts the level. The last choice
  applies to the next game. The message under the canvas gives each mode's controls
  and goal, and how the level ended (in versus: the winner, or a draw).
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
| `E`  | exit (shows up once all gold is taken) | `T`         | teleporter entrance        |
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
step 3 item (B-020 to B-028, see [`plans/step-3.md`](plans/step-3.md)). Done so far:
`Q` (B-020), the terrain `% ~ h R n` (B-022, see Terrain), the teleporters `T t`
(B-023, see Teleporters), the keys and doors `a b c A B C` (B-024, see Items, keys
and doors), the tools `j k` (B-025, see Tools) and the bombs `o O` (B-026, see
Bombs), the snare and gas gun `s g` (B-027, see Snares and gas) and the goo bucket
`u` (B-028, see Goo bucket): every tile now has its behavior and its palette entry.

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
  simulation. `paint` moves a player start (`P` or `Q`) instead of adding a second one;
  `paintLine` fills a segment (Bresenham) so a fast drag leaves no gaps. Undo covers
  the grid and the teleporter links (at most 100 steps); one mouse stroke
  (`beginStroke` … `endStroke`) is one step. `toLevel` runs the edited document through `parseLevel`, so the editor
  never hands the game a level an import would reject.
- **Teleporter links** follow the grid (`relink`, after every grid change and when a
  level is opened): a link whose entrance or exit is painted over goes, and an
  entrance without a link gets one to the nearest exit (by |dx| + |dy|, ties to the
  first exit in reading order). The **link tool**, after the tiles in the palette,
  re-points one: click an entrance, then an exit (`linkAt`, one undo step). Links show
  as dotted lines, and the picked entrance is framed. So the editor always holds valid
  links; only an entrance with no exit in the level is left unlinked, which the
  validator reports.
- **Editor screen** (`editor/view.ts`, the only editor file that touches the DOM): a
  palette (number keys 1–9, then 0 for the first ten entries, by `KeyboardEvent.code`, like the game keys), name and size
  fields, undo and redo. `editor/pointer.ts` maps canvas pixels to cells at any CSS
  scale and turns pointer events into model operations: the left button paints, the
  right one erases (with the link tool, a left click links instead and starts no
  drag), and release, cancel and lost capture all end the stroke, so letting
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
| Exit                            | absent until the last gold is taken, then appears                                         | S-015 @ 1:22               |
| Keys                            | carried in the item slot to the door of their colour                                      | S-016 @ 3:03–3:33          |
| Item slot                       | one item; picking up another swaps them in place                                          | S-016 @ 3:03–3:05          |
| Key used up on its door         | yes; one door per key                                                                     | Guillaume, 2026-10-29      |
| Opening a door                  | the key holder next to it (side, above, below), not diagonal                              | Guillaume, 2026-10-29      |
| Item of a player who dies       | kept while it waits to reappear                                                           | Guillaume, 2026-10-29      |
| Bombs                           | collected into a counter, fuse ≈ 2.5 s, chain reactions, blasted blocks back after ≈ 13 s | S-015 @ 1:05–1:24          |
| Bomb counter                    | one per player, for small and big bombs alike (one icon per bomb in the status bar)       | S-025 @ 0:04–1:20          |
| Which bomb is laid              | the first picked up                                                                       | Guillaume, 2026-10-29      |
| Small blast                     | its row ± 2 cells, rows above and below ± 1; brick only, back after 780 ticks (13 s)      | **Provisional**, S-015     |
| Big blast                       | round, dx² + dy² ≤ 5; destroys all terrain for good, bedrock included, not the exit       | **Provisional**, S-025     |
| Bomb victims                    | every monk and player in play whose centre is in the blast                                | **Provisional**            |
| Jackhammer                      | rides straight down through brick, ≈ 5 tiles in 9 s; tool kept                            | S-019 @ 2:33–2:43          |
| Jackhammer through bedrock      | drills bedrock too, as brick                                                              | Guillaume, 2026-10-29      |
| Jackhammer timing               | 100 ticks a cell, then falls in; the shaft refills like a dug hole                        | **Provisional**, to check  |
| Gas gun                         | cloud ≈ 3 cells in front for ≈ 6.5 s; monks inside stuck; gun kept; clouds can stack      | S-021 @ 0:53–1:05          |
| Gas: daze after the cloud       | ≈ 2.5 s, stars over the monk's head                                                       | S-021 @ 1:01–1:03.5        |
| Gas and players                 | the runner walks through the cloud and the stuck monks unharmed                           | S-021 @ 0:58–1:00          |
| Gas on ladders and bars         | no effect                                                                                 | S-005, to check            |
| Two-player race                 | mirrored halves, exits appear with the gold, first out wins                               | S-025                      |
| Versus end                      | first player out wins                                                                     | S-025 @ 0:04–1:24          |
| Versus gold and exits           | shared, as in co-op (any gold, any exit); both out on the same tick: draw                 | Guillaume, 2026-10-29      |
| Versus deaths                   | as in co-op: own lives, respawn at the start; a player can bury the other                 | **Provisional**, to check  |
| Co-op end                       | won when one player exits; a dead player alone restarts, on their own lives               | S-100 (2026-10-27)         |
| Lives at start (two players)    | 5 each (status bar shows 05 for both)                                                     | S-026 @ 0:01               |
| Two-player respawn delay        | 90 ticks (1.5 s) at the player's start                                                    | **Provisional**            |
| Monk target with two players    | the nearest player; players do not block each other                                       | **Provisional**, to check  |
| Pickaxe                         | rubble buries the monk on the next cell; ≥ 7 s; tool kept                                 | S-021 @ 0:08–0:15.5        |
| Pickaxe needs a ceiling         | only under a solid cell (rubble comes out of the ceiling)                                 | Guillaume, 2026-10-30      |
| Pickaxe rubble                  | falls 1 sub-unit a tick, lands solid as bedrock, crumbles after 420 ticks (7 s)           | **Provisional**, to check  |
| Rubble on a player              | crushes it, like a monk                                                                   | Guillaume, 2026-10-29      |
| Rubble on gold, items, exit     | never rests there: crumbles instead of sealing them                                       | Guillaume, 2026-10-29      |
| Goo bucket                      | the floor under the 3 cells in front turns to goo for good; one use; slows monks          | S-022 @ 3:16–3:17, @ 3:36  |
| Goo bucket: where               | stops at a wall, gap, ladder, hole, rubble or door; covers bedrock; not from a bar        | **Provisional**            |
| Goo bucket: digging             | bucket goo is gooey turf: no digging, no small-bomb crater, no drilling                   | **Provisional**, to check  |
| Teleporter                      | step in, reappear at the linked spot ≈ 0.5–1 s later (45 ticks, 0.75 s)                   | S-025; Guillaume, 10-29    |
| Teleporter: monks, blocked exit | monks use them; a monk on the exit delays the jump                                        | **Provisional**, to check  |
| Teleporter: player in transit   | monks keep chasing it, toward its exit                                                    | Guillaume, 2026-10-29      |
| Big bomb                        | same counter; round blast ≈ 5 cells, permanent; chain reactions                           | S-025 @ 1:04–1:15          |
| Snare                           | holds the first monk that walks in for good; others walk past                             | S-018 @ 0:23–0:48          |
| Snare: laid and used up         | picked up as an item, laid in the player's cell, one monk per snare                       | S-018 @ 0:22–0:48          |
| Snare and players               | never caught: players walk over armed snares unharmed                                     | S-100 (2026-10-30)         |
| Alcove                          | hiding place: a player inside cannot be caught                                            | S-018 @ 0:02–0:19, S-100   |
| Alcove: monks' sight            | monks do not see a hiding player (they chase another, or stand still)                     | Guillaume, 2026-10-29      |
| Trapdoor turf                   | drawn like brick; actors fall through; cannot be dug                                      | S-002, S-008               |
| Gooey turf speed                | 1 sub-unit per 6 ticks for runners and monks (3× slower runner, 2× slower monk)           | S-002; Guillaume, 10-29    |
| Hidden ladder                   | appears when the last gold is taken                                                       | S-001, S-025 @ 0:00–0:04   |
| Monk respawn points             | a dead monk reappears at a free `R`, picked at random                                     | S-001, pick to check       |
| Monk speed                      | 2/3 of the runner's                                                                       | **Provisional**, 1982 feel |
| Monk chase AI                   | classic floor scan (see Monks)                                                            | 1982 rule [^lrtr]          |
| Monk stuck in a hole            | 120 ticks (2 s), then climbs out                                                          | **Provisional**            |
| Runner standing on a hole       | the monk inside cannot climb out while a player in play stands there                      | S-100 (2026-10-28)         |
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
