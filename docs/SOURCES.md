# Sources

Every external source consulted about the original game, with what it gave us.
Facts taken from a source are recorded where they are used (mostly
`ARCHITECTURE.md` § Observed behavior of the original game), citing the source's id
here. Add a source the day it is consulted, even when it turns out to be useless, so
nobody looks it up twice.

**Reliability** is how far a fact from the source can be trusted for TLR on PC (1994):
**high** (shows or documents the PC game itself), **medium** (another version of TLR,
or a secondary write-up), **low** (a different game, used only as a fallback).

## Documents and pages

| Id    | Source                                                                                                                                                               | What it gives                                                                                                                                                                                                                    | Reliability                    | Consulted  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------- |
| S-001 | [Level Editor Guide (Saturn), GameFAQs](https://gamefaqs.gamespot.com/saturn/577611-lode-runner-the-legend-returns/faqs/33638)                                       | Grid of 28 × 16 tiles; the editor's 32 elements and what each does; editor options (day/night, music, background, test)                                                                                                          | medium (Saturn port)           | 2026-10-27 |
| S-002 | [Wikipedia: _Lode Runner: The Legend Returns_](https://en.wikipedia.org/wiki/Lode_Runner:_The_Legend_Returns)                                                        | One tool carried at a time; terrain types; 150 levels in 10 worlds (names); 30 two-player levels, co-op and hotseat versus                                                                                                       | medium                         | 2026-10-27 |
| S-003 | [Abandonware France, game page](https://www.abandonware-france.org/ltf_abandon/ltf_jeu.php?id=132)                                                                   | Two players at once on one screen, co-op or competing for gold; per-player keys (move, dig left/right, pick up/drop tool, use tool, small bomb); 640 × 480, 256 colors; DOS, Windows 3.x and Mac editions                        | high                           | 2026-10-27 |
| S-004 | [_Lode Runner Total Recall_, `lodeRunner.runner.js` and `lodeRunner.guard.js`](https://github.com/SimonHung/LodeRunner_TotalRecall/blob/master/lodeRunner.runner.js) | 1982 rules as reimplemented in JavaScript: digging checks, monk AI, respawn, gold carrying                                                                                                                                       | low (1982 game, fallback only) | 2026-10-25 |
| S-005 | [Jason Summers, _Bugs in Lode Runner_ (entropymine.com)](https://entropymine.com/jason/lr/nr/lrbugs/)                                                                | Bugs of TLR and _Lode Runner On-Line_: pickaxe rubble falls faster than monks and can freeze one mid-air; invisible ladders under rubble; gas has no effect on monks on ladders or bars; tool duplication bug (fixed in On-Line) | medium (search excerpts only)  | 2026-10-27 |
| S-006 | [_Mad Monks' Revenge: Definitive Edition_ manual, Quirks mode](https://mmr.quarkrobot.com/manual/quirks-mode)                                                        | Quirks of the sequel's engine: rubble can suspend a falling monk; a big bomb makes rubble permanent and invisible; pickaxe, jackhammer and gas can be dropped while in use                                                       | low (sequel; search excerpts)  | 2026-10-27 |
| S-007 | [Angel Lynn, review in _Game Bytes_ #21 (1994)](https://www.ibiblio.org/GameBytes/issue21/greviews/lode.html)                                                        | Snare (a monk walking on it hangs upside down; the player can be caught too); befuddlement gas dazes a monk for several seconds; small bombs open temporary holes, big ones destroy terrain                                      | medium (search excerpts only)  | 2026-10-27 |
| S-008 | [RGB Classic Games, game page](https://www.classicdosgames.com/game/Lode_Runner:_The_Legend_Returns.html)                                                            | DOS default keys for player 1 (arrows; keypad 7/9 dig, 1 pick up, 2 set a trap, 3 drop a bomb); co-op or competing two-player play; trapdoor turf                                                                                | medium (search excerpts only)  | 2026-10-27 |
| S-009 | [The Sierra Chest, walkthrough](https://www.sierrachest.com/index.php?a=games&id=180&title=lode-runner&fld=walkthrough&pid=20)                                       | Level-by-level walkthrough; not read yet (page outside the session's allowed domains)                                                                                                                                            | medium                         | not yet    |

## Videos (longplays)

YouTube answers HTTP 403 to video downloads from the cloud sessions (2026-10-27; the
playlist and its titles can still be listed), so episodes are watched from files
Guillaume sends: each file gets its own id (S-014 onwards) and facts cite it with a
timestamp in that file, e.g. `S-015 @ 1:07`. The S-010 titles give the 10 world names:
Moss, Fungus, Ancient, Crystal, Ice, Fossil, Lava, Phosphorus, Dark, Industrial.

| Id    | Source                                                                                                                  | What it shows                                                                                                                                                           | Reliability | Consulted  |
| ----- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| S-010 | [Sierra Chest, longplay playlist (39 videos)](https://www.youtube.com/playlist?list=PLgIVjvSpYdFIfj4QIMJjBfCzqn8p3xjGb) | The 150 levels, chapter by chapter (e.g. chapter 7, levels 97–103); episodes 3, 4 and 26 watched as S-014 to S-016                                                      | high        | 2026-10-27 |
| S-011 | [Longplay pt. 13, levels 46–54 (PC)](https://www.youtube.com/watch?v=_uDPImGl0GY)                                       | Levels 46–54 on PC                                                                                                                                                      | high        | not yet    |
| S-012 | [Longplay](https://www.youtube.com/watch?v=dRQFtXXsZWk)                                                                 | Full playthrough                                                                                                                                                        | high        | not yet    |
| S-013 | [DOS Game: Lode Runner – The Legend Returns](https://www.youtube.com/watch?v=BqnLuGRIAZw)                               | DOS version                                                                                                                                                             | high        | not yet    |
| S-014 | S-010 episode 3, _Moss World (3/3)_, levels 13–15 (file sent by Guillaume, 10:51)                                       | Moss tile set, monks; a key held in the item slot at level 15                                                                                                           | high        | 2026-10-27 |
| S-015 | S-010 episode 4, _Fungus World (1/3)_, levels 16–21 (file sent by Guillaume, 9:26)                                      | Grid 28 × 16 on PC; the exit appears with the last gold; bombs collected into a counter, fuse, chain reactions, blasted blocks coming back; one life per finished level | high        | 2026-10-27 |
| S-016 | S-010 episode 26, _Lava World (5/5)_, levels 104–105 and a cut scene (file sent by Guillaume, 6:18)                     | A key swapped into the item slot and carried to a red door that holds the exit; lives shown up to 99                                                                    | high        | 2026-10-27 |

## People

| Id    | Source                              | What it gives                                                                                                                   | Reliability | Consulted  |
| ----- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| S-100 | Guillaume's memories of playing TLR | Digging under gold and from a ladder are allowed; TLR (1994), not 1982, is the reference. Takes precedence over written sources | high        | 2026-10-25 |
