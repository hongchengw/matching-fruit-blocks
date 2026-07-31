# Task backlog

22 tasks that build Farmer's Match from an empty repo. Read [`../SPEC.md`](../SPEC.md) first;
it is the source of truth and every task file references it rather than restating it.

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
playwright.config.js         01
.gitignore                   01
index.html                   11, 12, 13, 16, 17, 21
css/style.css                11, 12, 13, 17, 22
js/palette.js                02
js/sprites.js                03, 04, 05, 06, 07, 08, 09, 10, 12
js/audio.js                  14
js/game.js                   15, 16, 17, 18, 19, 20, 21
tests/unit/*.test.js         01, 02, 03, 04-10, 14, 15, 16, 17, 18, 19, 20, 21
tests/e2e/*.spec.js          01, 03, 04-10, 11, 12, 13, 16, 17, 18, 20, 21, 22
```
