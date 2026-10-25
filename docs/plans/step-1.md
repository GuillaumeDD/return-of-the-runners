# Plan — Step 1: core engine and first playable level

Status: **proposed** (awaiting review). Roadmap: `docs/PRD.md` §7, step 1.
Backlog items: B-004 to B-010.

## Goal

A single hand-made level, playable in the deployed build: one runner moves, climbs
ladders, hangs on bars, falls, digs, collects all the gold and exits, while monks chase
them, fall into holes and die when the holes refill. Gameplay is driven by a pure,
deterministic simulation that replays byte-for-byte.

Out of scope for step 1: TLR terrain (bedrock aside), tools, 2 players, editor,
worlds/tile sets, sound, menus. The simulation API is shaped so these slot in later.

## Key design decisions

1. **Fixed timestep:** 60 ticks per second. The render loop accumulates real time and
   runs whole ticks; the simulation never sees time, only a tick count.
2. **Integer sub-tile positions:** each tile is `SUB = 8` sub-units wide and high.
   Actors move a whole number of sub-units per tick group, which gives smooth
   movement without floats. All speeds and durations are integer constants in one
   file (`src/sim/rules.ts`), so they can be tuned to match the original.
3. **Grid-aligned turning:** like the original, an actor can only change axis (start
   climbing, step off a ladder) when aligned on the tile grid. Off-axis input "snaps"
   the actor toward alignment first.
4. **State is plain data** (no classes, no closures), so it can be hashed, cloned and
   compared in tests. `step(state, inputs) → state` is the only entry point.
5. **Monk AI** is a deterministic greedy chase in the classic Lode Runner style (prefer
   reaching the runner's row, then their column, via ladders/bars), with ties broken
   by fixed order, never by randomness. The PRNG is only used for monk respawn
   position among candidate cells.
6. **State hash:** FNV-1a 32-bit over a canonical, ordered byte serialization of the
   state (no `JSON.stringify` of objects with unordered keys).

## Level format v1 (B-004)

```json
{
  "format": "return-of-the-runners/level",
  "version": 1,
  "name": "First steps",
  "width": 28,
  "height": 16,
  "grid": ["############################", "..."]
}
```

| Char | Tile                                   |
| ---- | -------------------------------------- |
| `.`  | empty                                  |
| `#`  | brick (diggable)                       |
| `@`  | bedrock (not diggable)                 |
| `H`  | ladder                                 |
| `-`  | bar (hand-over-hand)                   |
| `$`  | gold                                   |
| `E`  | exit (locked until all gold collected) |
| `P`  | runner start (exactly one in v1)       |
| `M`  | monk start (0 to 16)                   |

Limits: `width` 8–64, `height` 8–48, `name` ≤ 64 chars, raw input ≤ 64 KB, at least one
`$`, exactly one `P`, at least one `E`. The 28×16 default mirrors the 1982 grid;
**the TLR grid size is unconfirmed** (see open questions) and is a level property
precisely so it can change without a format bump.

## Delivery: one PR per backlog item

Ordered so something visible arrives early (B-009 right after movement):

| Order | PR          | Backlog | Visible result                                     |
| ----- | ----------- | ------- | -------------------------------------------------- |
| 1     | Level v1    | B-004   | none (format, validator, fixtures)                 |
| 2     | Movement    | B-005   | none (simulation only)                             |
| 3     | Playable    | B-009   | **the runner moves around a level in the browser** |
| 4     | Digging     | B-006   | digging and holes refilling                        |
| 5     | Gold & exit | B-007   | a level can be won                                 |
| 6     | Monks       | B-008   | monks chase; the game is now Lode Runner           |
| 7     | Replays     | B-010   | determinism proven in Node and Chromium            |

## Modules and enumerated tests

### B-004 — Level format v1

- `src/level/format.ts`: types, tile alphabet, limits.
- `src/level/parse.ts`: `parseLevel(text: string): Result<Level, LevelError[]>`.

`tests/level/parse.test.ts`

- accepts every fixture in `tests/fixtures/levels/v1/valid/`;
- rejects every fixture in `tests/fixtures/levels/v1/invalid/`, each with its expected
  error code (one fixture per rule below);
- rejects: non-JSON; wrong `format`; unknown `version` (0, 2, `"1"`); missing field;
  extra unknown field; `width`/`height` out of bounds or non-integer; row count ≠
  `height`; row length ≠ `width`; unknown tile char; zero or two `P`; no `$`; no `E`;
  more than 16 `M`; `name` empty or > 64 chars; input > 64 KB;
- returns all errors, not just the first;
- never throws on any input (errors are values).

`tests/level/parse.fuzz.test.ts`

- 2,000 random byte strings, and 2,000 mutations of valid fixtures (flip a char, drop
  or duplicate a row, change a number, truncate): `parseLevel` never throws, and
  every accepted output satisfies all invariants above (seeded, so failures replay).

### B-005 — Simulation core: movement

- `src/sim/prng.ts`: seeded PRNG (mulberry32).
- `src/sim/rules.ts`: all tunable constants.
- `src/sim/state.ts`: `createState(level, seed)`; plain-data state.
- `src/sim/step.ts`: `step(state, inputs)`.
- `src/sim/physics.ts`: support, falling, alignment helpers.
- `src/sim/hash.ts`: canonical serialization + FNV-1a.

`tests/sim/prng.test.ts`

- same seed → same sequence; different seeds → different sequences;
- outputs are 32-bit unsigned integers; `nextInt(n)` stays in `[0, n)`;
- matches a committed reference sequence for seed 42 (guards against accidental
  algorithm changes).

`tests/sim/movement.test.ts` (each on a tiny inline level)

- walks left/right on brick, stops at walls and level edges;
- climbs up and down a ladder; cannot climb where there is no ladder;
- reaching the top of a ladder lets the runner step onto the floor beside/above it;
- moves along a bar; pressing down on a bar drops the runner;
- falls when there is no support (empty below, not on ladder/bar), lands on brick,
  bedrock, ladder top, or the bottom row;
- grabs a bar when falling through its cell;
- cannot turn onto a ladder until aligned; input snaps toward alignment;
- no jump: pressing up with no ladder does nothing;
- speeds match `rules.ts` (moves exactly `N` sub-units in `T` ticks).

`tests/sim/hash.test.ts`

- equal states → equal hash; any single-field change → different hash;
- hash is independent of object key insertion order;
- committed hash for a fixed level + seed + empty input over 600 ticks.

`tests/sim/physics.reference.test.ts`

- randomized cross-check: for 5,000 random small grids and positions, `isSupported`
  and `canMove` agree with a naive reference written directly from the rules table.

### B-009 — Renderer, input, first playable level

- `src/render/canvas.ts`: draws grid and actors from state (placeholder shapes; no
  assets yet, so nothing to add to `ASSETS.md`).
- `src/input/keyboard.ts`: key state → per-tick commands; default bindings
  arrows + `Z`/`X` to dig (remappable later).
- `src/game/loop.ts`: fixed-timestep accumulator.
- `levels/first-steps.json`: our first level (CC BY-SA 4.0).

`tests/input/keyboard.test.ts`

- held keys map to commands; releasing clears them; opposite directions cancel;
- bindings come from a table (no hard-coded keys in logic).

`tests/game/loop.test.ts`

- with a fake clock: 1 s of time → exactly 60 ticks; large frame gaps are capped
  (no "spiral of death"); leftover time carries over.

`tests/levels/bundled.test.ts`

- every bundled level parses with no errors.

Plus an i18n key for any new UI string (EN + FR), and a screenshot in the PR.

### B-006 — Digging and holes

`tests/sim/dig.test.ts`

- digging left/right opens a hole in the brick diagonally below on that side;
- cannot dig bedrock, ladders, empty cells, or under a brick/ladder/bar blocking
  the cell above the target; can dig under gold (TLR);
- cannot dig while falling; can dig from a ladder or a bar (1982 rule, see ARCHITECTURE);
- the hole is dug over `HOLE_TICKS.digging`, stays open for `HOLE_TICKS.open`, then
  refills over `HOLE_TICKS.closing`;
- a runner inside a hole when it refills dies;
- the runner can fall into and walk through an open hole.

### B-007 — Gold and exit

`tests/sim/gold.test.ts`

- touching gold collects it and increments the counter;
- the exit stays locked while gold remains; unlocks when the last gold is taken;
- entering the unlocked exit completes the level; entering a locked exit does not.

### B-008 — Monks

`tests/sim/monk.test.ts`

- monks follow the same movement and falling rules as the runner (shared code);
- a monk touching the runner kills them;
- a monk that walks over gold may pick it up (one at a time) and drops it when it
  falls into a hole (to confirm against original);
- a monk in a hole is stuck for `MONK_TRAPPED_TICKS`, then climbs out if the hole is
  still open; the runner can walk across a trapped monk's head;
- a monk inside a refilling hole dies and respawns at a PRNG-chosen top-row cell
  after `MONK_RESPAWN_TICKS`;
- monks never overlap each other.

`tests/sim/monk-ai.test.ts`

- on hand-made mazes: the monk reaches the runner's row via the nearest ladder;
- tie-breaking is fixed (same state → same choice);
- randomized cross-check: on 2,000 random small levels, the monk's chosen direction
  equals the one computed by a naive reference implementation of the same rules.

### B-010 — Replay determinism

- `src/sim/replay.ts`: input log format (run-length encoded per tick).
- `tests/fixtures/replays/*.json`: level + seed + inputs + expected final hash.

`tests/sim/replay.test.ts`

- each committed replay reaches its expected hash in Node;
- replaying twice in the same process gives the same hash at every 60th tick.

`e2e/replay.spec.ts` (Playwright, Chromium, run in CI)

- the same replays run in the browser bundle reach the same hashes.

## Open questions (faithfulness)

Provisional values come from the 1982 game. Each one becomes an
`ARCHITECTURE.md` entry with provenance once checked against a TLR video or playtest.

1. Grid size of TLR levels (columns × rows).
2. Exit mechanism: door, appearing ladder, or both depending on the level?
3. Runner and monk speeds; hole open and refill durations.
4. Can the runner dig while hanging on a bar or standing on a ladder?
5. Monk gold-carrying rules: do they always pick gold up? When do they drop it?
6. Where do dead monks respawn?
