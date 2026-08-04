# Task backlog

Tasks 01 through 22 build Farmer's Match from an empty repo. Tasks 23 onward change the built
game, and come from playing it rather than from the original design. Read
[`../SPEC.md`](../SPEC.md) first; it is the source of truth and every task file references it
rather than restating it.

Tasks that change behavior amend `SPEC.md` before they touch code. A task in the second group
may contradict a task in the first, and where it does, the newer task says so and gives the
reason.

Execution rules live in [`../AGENTS.md`](../AGENTS.md). The short version: write the failing
tests first, commit them RED, implement, commit GREEN, log to `changelogs/CHANGELOGS.md`,
push to `origin/main`.

## Index

| # | Task | Depends on | Test surface |
|---|---|---|---|
| [01](01-test-tooling-scaffold.md) | Test tooling scaffold | none | meta |
| [02](02-palette.md) | `js/palette.js` earth-tone palette | 01 | Vitest |
| [03](03-sprite-renderer.md) | `js/sprites.js` renderer | 01, 02 | Vitest + Playwright |
| [04](04-sprite-apple.md) | Apple sprite | 02, 03 | Vitest + Playwright |
| [05](05-sprite-banana.md) | Banana sprite | 02, 03 | Vitest + Playwright |
| [06](06-sprite-carrot.md) | Carrot sprite | 02, 03 | Vitest + Playwright |
| [07](07-sprite-corn.md) | Corn sprite | 02, 03 | Vitest + Playwright |
| [08](08-sprite-tomato.md) | Tomato sprite | 02, 03, 04 | Vitest + Playwright |
| [09](09-sprite-pumpkin.md) | Pumpkin sprite | 02, 03 | Vitest + Playwright |
| [10](10-sprite-card-back.md) | Card back sprite | 02, 03 | Vitest + Playwright |
| [11](11-html-skeleton-base-css.md) | `index.html` + base CSS | 01 | Playwright |
| [12](12-stall-chrome.md) | Stall scene chrome | 03, 11 | Playwright |
| [13](13-grid-and-flip-css.md) | 6x6 grid + card flip CSS | 11 | Playwright |
| [14](14-audio-engine.md) | `js/audio.js` + mute | 01 | Vitest |
| [15](15-deck-construction.md) | Deck construction + shuffle | 01 | Vitest |
| [16](16-honest-game-loop.md) | Honest game loop | 03, 13, 14, 15 | Vitest + Playwright |
| [17](17-scoreboard.md) | Scoreboard render + freeze | 12, 16 | Vitest + Playwright |
| [18](18-rig-arming-and-midpoint-swap.md) | Rig arming + midpoint swap | 13, 16 | Vitest + Playwright |
| [19](19-reroll-fruit.md) | `rerollFruit` rules | 15, 18 | Vitest |
| [20](20-silent-reshuffle.md) | `silentReshuffle` + tally invariant | 15, 19 | Vitest + Playwright |
| [21](21-persistence-and-curse.md) | Persistence + compounding curse | 16, 18 | Vitest + Playwright |
| [22](22-final-integration.md) | Responsive, touch, a11y, full E2E | all | Playwright |

## Post-QA changes

Written after the game was played. Each one changes specified behavior, so each amends
`SPEC.md` first.

| # | Task | Depends on | Test surface |
|---|---|---|---|
| [23](23-outdoor-scene.md) | Move the stall outdoors | 11, 12, 22 | Playwright |
| [24](24-honest-board-stability.md) | The honest board holds still | 16, 20, 22 | Vitest + Playwright |
| [25](25-non-destructive-reset.md) | Reset stops compounding the curse | 21, 22 | Vitest + Playwright |

23, 24 and 25 are independent of each other and can land in any order. 24 and 25 both soften
behavior that earlier tasks built deliberately; both say which task they contradict and why.

## Second QA pass

Written after playing the finished game end to end. The first three sharpen the psychology; the
last two are presentation.

| # | Task | Depends on | Test surface |
|---|---|---|---|
| [26](26-asymptotic-wall.md) | Seal the statistical channel | 18, 19, 24, 25 | Vitest + Playwright |
| [27](27-cold-card-reshuffle.md) | Rot the board from the edges | 19, 20, 24 | Vitest + Playwright |
| [28](28-manufactured-near-misses.md) | Manufacture the near miss | 19, 24 | Vitest + Playwright |
| [29](29-crate-variation.md) | Break up the wall of brown | 10, 13, 23 | Playwright |
| [30](30-ambient-sound.md) | Ambient sound for the stall | 14, 23 | Vitest + Playwright |

**Task 26 is the important one.** §10.3 seals four channels and there is a fifth: after the wall
the match rate is exactly zero, permanently and by construction, which is proof by inference for
any player who counts. 26 is also the only task here that needs the owner's sign-off before it
starts, because sealing that channel means amending §2.6's frozen counter.

26, 27 and 28 all touch the rigged phase and interact. Landing 26 first is recommended: it is
the one that changes what the phase *is*, and 27 and 28 both make more sense measured against it.

27 and 28 each need a notion of "recently seen". Whichever lands second should unify them rather
than keep two subtly different definitions.

29 carries a trap worth reading before starting: card-back variation must be bound to the grid
slot and never to the card, or the player can track a card straight through a reshuffle and watch
its fruit change, which is §10.3's visual channel reopened by a decorative change.

## Dependency graph

```
01 test tooling
├── 02 palette
│   └── 03 renderer
│       ├── 04 apple ──┐
│       ├── 05 banana  │
│       ├── 06 carrot  │
│       ├── 07 corn    │
│       ├── 08 tomato ─┘ (also depends on 04: must differ from apple)
│       ├── 09 pumpkin
│       └── 10 card back
├── 11 html + base css
│   ├── 12 stall chrome  (also needs 03)
│   └── 13 grid + flip css
├── 14 audio
└── 15 deck construction

16 honest loop      <- 03, 13, 14, 15
├── 17 scoreboard   <- 12, 16
├── 18 rig + swap   <- 13, 16
│   ├── 19 reroll   <- 15, 18
│   │   └── 20 reshuffle <- 15, 19
│   └── 21 persistence   <- 16, 18
└── 22 integration  <- everything

22 integration
├── 23 outdoor scene        <- also 11, 12
│   ├── 29 crate variation  <- also 10, 13
│   └── 30 ambient sound    <- also 14
├── 24 honest board still   <- also 16, 20
│   ├── 26 asymptotic wall  <- also 18, 19, 25
│   ├── 27 cold reshuffle   <- also 19, 20
│   └── 28 near misses      <- also 19
└── 25 non-destructive reset <- also 21
```

Acyclic. 01 is the only task with no dependencies and must land first.

## Parallelizable sets

Tasks within a set are independent of each other and can run concurrently once the set's
prerequisites are green.

| Set | Tasks | Unlocked by |
|---|---|---|
| A | 02, 11, 14, 15 | 01 |
| B | 04, 05, 06, 07, 09, 10 | 03 |
| C | 12, 13 | 11 (12 also needs 03) |
| D | 17, 18 | 16 |
| E | 19, 21 | 18 |

Set B is the widest fan-out: six sprite tasks with no coupling. Task 08 (tomato) is held out
of set B because it must be visually distinct from apple, so 04 has to land first.

## Critical path

```
01 -> 02 -> 03 -> 16 -> 18 -> 19 -> 20 -> 22
```

Eight tasks. Everything else can be scheduled around it.

## Task file structure

Every task file uses the same headings, so they are interchangeable to whoever executes them:

- **Objective**: one sentence
- **Depends on**: task ids
- **Spec reference**: the governing section of `SPEC.md`
- **Files created or modified**
- **Tests to write first**: each test named, with its runner and its exact assertion, phrased
  so it fails against an absent implementation
- **Implementation notes**: constraints only, never code
- **Definition of done**

## File coverage

The union of every task's "files created or modified" is the complete target tree. No orphans,
no gaps.

```
package.json                 01
vitest.config.js             01
playwright.config.js         01, 22
.gitignore                   01
index.html                   11, 12, 13, 16, 17, 21, 22, 23, 30
css/style.css                11, 12, 13, 17, 22, 23, 29
js/palette.js                02, 23
js/sprites.js                03, 04, 05, 06, 07, 08, 09, 10, 12
js/audio.js                  14
js/ambience.js               30
js/game.js                   15, 16, 17, 18, 19, 20, 21, 24, 25, 26, 27, 28, 30
scripts/serve.js             01, 22
SPEC.md                      18, 22, 23, 24, 25, 26, 27, 28, 29
SECURITY.md                  22, 25
tests/unit/*.test.js         01, 02, 03, 04-10, 14, 15, 16, 17, 18, 19, 20, 21, 24-28, 30
tests/e2e/*.spec.js          01, 03, 04-10, 11, 12, 13, 16, 17, 18, 20-30
```

`SPEC.md` appears here because tasks 18 and 22 onward amend it as part of their own diff, per
`AGENTS.md`. It is not otherwise a task output.
