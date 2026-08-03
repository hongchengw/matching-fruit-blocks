# Changelog

Every change to this repository gets an entry. **Newest first.** Append at the top, never
rewrite an existing entry.

## Format

```
## YYYY-MM-DD HH:MM EDT | <conventional-commit-style summary>
<1 to 3 lines: what changed, which tests now cover it, anything deferred>
```

Timestamps are **EDT**, never UTC and never the machine's local time:

```
TZ=America/New_York date "+%Y-%m-%d %H:%M EDT"
```

See [`../AGENTS.md`](../AGENTS.md) for the full per-task loop this log is part of.

---

## 2026-08-03 05:24 EDT | feat(reroll): the real reroll selection rules (task 19)

Replaced task 18's stub with `rerollFruit`: exclude the first card's fruit (hard, never
dropped), exclude the card's `lastShown` (soft, dropped only if it would empty the pool), then
prefer fruits still in play as a preference rather than a filter. Pure, and it never reads
`matches`, `rigLevel`, or `rigged`.
`fruits` is injectable purely so the fallback is reachable at all: with the full six, the two
exclusions can never empty the candidate set, and an untestable branch in the rig's hot path is
worse than a parameter. Covered by 12 unit tests including the distribution check and a 50
attempt rigged run that never matches and never repeats a card's last fruit.

Rewrote the oracle in the task 18 frame-by-frame test. It compared each frame against the
card's pre-swap fruit, but the reroll may legitimately land back on that same fruit, since §7.2
excludes only the first card's fruit and `lastShown`. The test therefore reported a leak where
none had happened. It now asserts the stronger property: no readable frame may show anything
other than the sprite committed at the midpoint, and the face is observed blank beforehand. The
spec's own wording is still asserted whenever the identity actually moved. This is a stricter
assertion than the one it replaces, not a looser one. Verified over three repeat runs.
Full suite green: 141 unit, 57 e2e.

## 2026-08-03 05:18 EDT | feat(scoreboard): LCD readouts and the frozen counter (task 17)

Added `formatScoreboard`, a pure function of `matches` over the fixed denominator of 18, and the
two recessed LCD readouts in the scoreboard panel. Tabular figures and a minimum width keep the
digits from shifting, since layout jitter around a counter that has quietly stopped moving is
what would draw a player's eye to it.
The freeze is written nowhere. It falls out of `matches` never incrementing again, exactly as
SPEC.md §2.6 requires, and a unit test reads the function's own source to fail anyone who later
adds a freeze branch, a rig check, or a high-water cache. Covered by 6 unit and 4 e2e tests
including 25 attempts past the threshold with the readout still on 5/18 and 13 matches dangling.
Raised that test's Playwright timeout: 25 attempts at the spec's 1000ms flip-back is over 30
seconds of real waiting, so it buys time rather than shortening the run.
Updated the stall snapshot baseline deliberately, since the scoreboard panel is no longer empty.
Full suite green: 129 unit, 57 e2e.

## 2026-08-03 05:11 EDT | feat(rig): rig arming and the midpoint swap (task 18)

Added the derived `rigged` getter and the swap. The rigged second card starts its rotation with
an unpainted face and its identity is decided and drawn once, at the midpoint, from
`flipMidpoint(readFlipMs())`. The true fruit is never drawn at all, so there is no pre-swap
frame to catch rather than a frame that is merely hard to see. Reduced motion needs no special
case: the midpoint follows the CSS custom property down to 80ms.
The outcome is settled at click time, not after the swap, because a rigged attempt can never
match by construction. The mismatch cue and the 1000ms timer therefore start at the same point
in the attempt as they do honestly, which is what makes the two phases indistinguishable by ear
and by stopwatch. Measured at 1 to 2ms apart in the browser.
Ships a deliberately dumb reroll stub behind a seam; task 19 fills it.
Covered by 14 unit tests and 4 e2e including the frame-by-frame invariant under both motion
settings.

Took task 18 before task 17, since two of task 17's e2e tests assert the scoreboard freezes
after the rig arms and cannot be written against an unrigged game. Both are unlocked by 16 and
independent of each other, so the order is free.

Adjusted the two winnability tests from task 16, which played 18 pairs at the default rig level
and could no longer pass once the rig existed. Both now push the threshold out of reach and
assert the same thing: every one of the 18 pairs is findable. The e2e does it through a
`&fm-rig=` parameter honored only alongside `?fm-test=1`. That is a test affordance, not an
escape hatch: nothing in the UI mentions it and it cannot be reached in normal play. Full suite
green: 123 unit, 53 e2e.

## 2026-08-03 05:06 EDT | feat(loop): honest game loop (task 16)

Added the state machine to `js/game.js`: one guarded `flip` entry point, match locking, the
1000ms flip-back, and the `busy` input lock. The machine never touches the DOM; `mount` renders
from an `onChange` callback, which is what keeps it testable under jsdom with no markup.
The game is now playable and completely fair. Tasks 18 through 20 layer the rig on top without
changing this loop's shape, so the rigged and honest timings are identical for free. The
mismatch call site for task 20's reshuffle is marked but deliberately not stubbed.
Wired the previously inert mute button here, since this is where the DOM entry point now lives.
Covered by 12 unit tests and 5 e2e including a full 18-pair playthrough that proves the honest
phase is genuinely winnable. Playwright reads the board through a `?fm-test=1` debug hook that
is absent in normal play; a global listing every card's fruit would be a detection channel of
its own. Full suite green: 109 unit, 49 e2e.

## 2026-08-03 04:59 EDT | feat(deck): 36-card deck and Fisher-Yates shuffle (task 15)

Added `js/game.js` with the pure deck helpers: `shuffle` (copies, walks down with an inclusive
bound so the last element can move, injectable random source) and `buildDeck` (six of each
fruit, ids 0 to 35, all face down).
Promoted the six fruit names to a frozen `FRUITS` export in `js/sprites.js` and imported it
rather than restating the list, so a typo cannot desynchronize the board from the sprite
registry. Covered by 13 unit tests including the even-count invariant stated at its origin and
an unbiasedness check over 500 runs. Full suite green: 97 unit, 44 e2e.

## 2026-08-03 04:56 EDT | feat(audio): 8-bit cue engine and mute (task 14)

Added `js/audio.js`: three square-wave cues built from one shared `tone` primitive, a context
created lazily inside the first cue rather than at module load, and mute persisted into
`fm.state` with a read-modify-write so task 21's sibling key survives.
The parity requirement is structural, not incidental: the module imports nothing from the game,
every cue takes zero arguments, and the only branch in the file is on mute. Covered by 16 unit
tests including graph-level parity and a source-level guard that no game-state token appears.

Fixed one test that could never reach its assertions. `does not import game state` resolved the
source path from `import.meta.url`, which under jsdom is the document URL, so `readFileSync`
threw `ERR_INVALID_URL_SCHEME` first. Resolving from the project root instead let the guard run,
and it immediately caught two prose comments in the implementation, which were reworded. The
assertion itself is unchanged. Full suite green: 84 unit, 44 e2e.

## 2026-07-31 07:18 EDT | feat(grid): 6x6 board and card flip (task 13)

Added 36 static cards in a `repeat(6, 1fr)` grid and the two-faced flip: `rotateY` over 180ms,
linear, with `backface-visibility: hidden` and `preserve-3d`. Exposed `--fm-flip-ms` as a
unitless custom property so task 18 can derive the swap midpoint instead of hardcoding 90.
Reduced motion shortens it to 80ms and shrinks the property with it, keeping the midpoint
proportional and the hiding place intact.

Reworked two tests that were unsound as written. `flip uses rotateY` read the transform before
the transition began and caught the identity matrix; it now waits for completion. `card is
unreadable at the flip midpoint` timed from the style change rather than the transition start,
sampling roughly 74 degrees instead of 90, and the assertion window is only a few milliseconds
wide, so no wall-clock timer can land it reliably. Replaced with three stronger tests: the
geometry collapses when edge-on, the timing function is linear (so half the duration is exactly
90 degrees by construction), and a real flip is observed passing through that region. This is a
correction to flawed measurement, not a loosened assertion.

Updated the stall snapshot baseline deliberately: the grid now holds 36 cards. Full suite
green: 68 unit, 44 e2e.

## 2026-07-31 07:12 EDT | feat(chrome): stall scene dressing (task 12)

Dressed the five regions into an actual market stall: scalloped striped awning (CSS mask, no
image asset), signboard with title and mute toggle, crate-slat grid background, and a wooden
base with two hanging price tags and the reset button.
Covered by 10 Playwright tests including a warm-tone check that encodes the SPEC.md §2.10
rationale, plus a committed visual snapshot baseline at 800x900. Mute and reset are inert
markup; tasks 14 and 21 wire them. Full suite green: 68 unit, 28 e2e.

## 2026-07-31 07:09 EDT | feat(chrome): page skeleton and base CSS (task 11)

Added `index.html` with the five `data-region` stall containers in spec order, and
`css/style.css` with 11 chrome custom properties, the raised/recessed bevel primitive at 3px,
and the monospace type stack.
Covered by 11 Playwright tests in `tests/e2e/page-structure.spec.js`. Two guard spec
constraints rather than appearance: every script tag must be `type=module` (no bundler), and
every request must be same-origin app files (no CDN fonts). Regions ship as empty containers;
tasks 12, 13, 17, and 21 fill them. Full suite green: 68 unit, 18 e2e.

## 2026-07-31 07:01 EDT | feat(sprites): card back sprite (task 10)

Added the 16x16 card back: full-bleed `B` crate slats with `b` highlight lines and a small
centered `G` leaf. Every pixel opaque, three characters total, one shared entry for all 36
cards.
Covered by the shared shape suite plus four dedicated unit tests (fully opaque, no per-card
variants, explicit outline/margin exemption, low contrast) and a browser test comparing it to
every fruit in full RGBA rather than by alpha mask. Completes the sprite set: 7 registered.
Full suite green: 68 unit, 7 e2e.

## 2026-07-31 06:59 EDT | feat(sprites): pumpkin sprite (task 09)

Added the 16x16 pumpkin: widest sprite in the set, `O` body with `o` vertical ribs, closed `K`
outline, and a short thick `B` stem.
Completes the six fruits, so the pairwise silhouette matrix now runs all 15 pairs. Worst pair
is apple/pumpkin at 21.9 percent against a 12 percent threshold; every other pair is above 22
percent. Full suite green: 58 unit, 6 e2e.

## 2026-07-31 06:57 EDT | feat(sprites): tomato sprite (task 08)

Added the 16x16 tomato: compact squat `R` body with an `r` highlight, closed `K` outline, and
a five-point `G` calyx spread flat across the top.
Added the dedicated `tomato and apple differ by silhouette alone` test, which compares binary
alpha masks with color discarded. Verified it discriminates: a placeholder tomato that was
just a recolored apple failed it with the intended message before the real sprite landed.
Apple against tomato measures 23.8 percent. Full suite green: 52 unit, 6 e2e.

## 2026-07-31 06:55 EDT | feat(sprites): corn sprite (task 07)

Added the 16x16 corn: upright `Y`/`y` kernel-checkered cob with a closed `K` outline and `G`
husk leaves flaring down and out at the base.
The flare is the inverse of the carrot's taper, which is what keeps the two apart at 44px.
Kernels held at 1px granularity so the texture survives downscaling. Full suite green: 46
unit, 5 e2e.

## 2026-07-31 06:54 EDT | feat(sprites): carrot sprite (task 06)

Added the 16x16 carrot: narrow vertical taper in `O` with an `o` highlight column, closed `K`
outline, and a `G` frond tuft on top.
Deliberately thinner than first drafted. An earlier wider carrot measured only 15.2 percent
against corn, so the body was narrowed to clear the threshold with room to spare. Full suite
green: 40 unit, 5 e2e.

## 2026-07-31 06:42 EDT | feat(sprites): banana sprite (task 05)

Added the 16x16 banana: diagonal crescent in `Y` with a `y` highlight along the upper left,
closed `K` outline, and a `B` tip.
Extended both shared suites to cover it. The pairwise silhouette check is no longer vacuous:
apple against banana measures 22.7 percent mask difference against a 12 percent threshold.
Full suite green: 34 unit, 5 e2e.

## 2026-07-31 06:40 EDT | feat(sprites): apple sprite (task 04)

Added the 16x16 apple to `js/sprites.js`: round `R` body with an `r` highlight, closed `K`
outline, `B`-free all-`K` stem, and a `G` leaf swept right.
Introduced the two shared suites the remaining sprite tasks extend:
`tests/unit/sprites-shape.test.js` (6 tests: grid shape, palette coverage, non-blank, 1px
margin, closed outline) and `tests/e2e/sprite-distinctness.spec.js` (44px legibility plus a
pairwise alpha-mask comparison that discards color). Full suite green: 28 unit, 5 e2e.

## 2026-07-31 06:36 EDT | feat(sprites): sprite registry and renderer (task 03)

Added `js/sprites.js` with `SPRITES`, `SPRITE_SIZE`, `registerSprite` (validates the 16x16
grid shape at registration), and `drawSprite` (native-resolution single-pass paint, sets
`image-rendering: pixelated`).
Covered by 12 unit tests against a mocked canvas and 2 Playwright tests doing `getImageData`
probes and an unsmoothed-upscale check. `drawSprite` paints exactly once, which task 18's
midpoint swap depends on. Registry ships empty; tasks 04-10 populate it.

## 2026-07-31 06:34 EDT | feat(palette): earth-tone sprite palette (task 02)

Added `js/palette.js`: a frozen char-keyed palette of 12 earth tones plus the `TRANSPARENT`
sentinel, with `isTransparent` and a throwing `colorFor` lookup.
Covered by 8 unit tests in `tests/unit/palette.test.js`, including the earth-tone hue and
saturation bounds and the uppercase-base / lowercase-highlight lightness relationship. Full
suite green.

## 2026-07-31 06:33 EDT | feat(tooling): vitest and playwright scaffold (task 01)

Added `package.json` (devDependencies only, `type: module`), `vitest.config.js` with the
jsdom environment, `playwright.config.js`, and a dependency-free static server at
`scripts/serve.js` for Playwright's `webServer`.
Covered by `tests/unit/smoke.test.js` (runner executes, jsdom available) and
`tests/e2e/smoke.spec.js` (static server responds 200). `npm test` and `npm run e2e` both
green. Only chromium is installed locally; task 22's cross-engine run will need the rest.

## 2026-07-31 06:21 EDT | docs: project specification and 22-task backlog

Added `SPEC.md` as the source of truth, rewrote `AGENTS.md` with the RED/GREEN per-task loop,
and created `tasks/` with an index plus 22 task files covering scaffold through final
integration.
No application code, test code, or tooling config written; every task file specifies the
failing tests to write first. Documentation-only, so the test gate does not apply per
`AGENTS.md`. Awaiting review before build begins.
