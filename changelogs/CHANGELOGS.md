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

## 2026-08-04 02:39 EDT | docs(tasks): three tasks from the first real QA pass

Added `tasks/23-outdoor-scene.md`, `tasks/24-honest-board-stability.md` and
`tasks/25-non-destructive-reset.md`, and indexed them in `tasks/README.md` under a new post-QA
group, since they change the built game rather than build it. Documentation only: no `SPEC.md`
amendment and no code, both of which belong to the tasks themselves.

Task 24 is worth reading before task 25. QA reported the board shifting before a single match
had been made, and that turned out not to be a defect: `js/game.js:308` calls `silentReshuffle`
with no `rigged` guard, which is exactly what §2.5, §6.5 and §7.3 ask for, all three of them
saying "every failed attempt". The implementation was correct and the specification is what the
owner disagrees with, so the task amends the spec first. No test caught it because
`the honest phase is genuinely winnable` re-reads the board with a fresh lookup each attempt, so
nothing ever asserted the board holds still while honest. That gap is the new task's first test.
Recorded there that gating the reshuffle opens a small detection channel of its own, since the
reshuffle would then begin at the same moment the rig arms, and that this was weighed and
accepted rather than missed.

Task 25 reverses part of task 21 at the owner's direction: Reset stops decrementing `rigLevel`,
so the honest phase returns on every new round and the game becomes unwinnable per round rather
than permanently. That contradicts `AGENTS.md`'s standing instruction not to soften the rig, so
the task file leads with the fact that it is deliberate, lists every spec section it changes
(§1, §2.7 deleted outright, §2.8, §8, §10.3), and names all nine tests whose behavior is being
removed, on the grounds that a deliberately removed behavior is the only acceptable reason to
delete a passing test.

Task 23 moves the stall outdoors under a clear sky, staying in the 16x16 pixel idiom with no
image assets. It carries the two constraints that will otherwise bite: §3.1 caps the palette at
roughly 12 earth tones and §2.10 requires warm chrome, and the `chrome is warm-toned` guard at
`stall-chrome.spec.js:102` fails any hue between 200 and 300 across every `[data-region]`. The
task requires the exemption be a single named selector rather than a widened hue band, since
that band is what carries §2.10.

## 2026-08-04 02:11 EDT | test(integration): the assembled game, verified on three engines (task 22)

Task 22 adds no features and did not need to: nothing in `js/` changed. It drives the finished
game and proves the pieces hold together, which is what nineteen tests across a full
playthrough, four viewports, touch, keyboard, and a fifty-attempt regression sweep are for. All
four sealed channels from SPEC.md §10.3 are now asserted together, on every attempt, inside one
continuous playthrough rather than separately: no readable frame carries anything but the
committed sprite, every mismatch cue is one shape, every unmatched fruit count stays even, and
`rigLevel` survives a reload and a reset. Full suite green: 163 unit, 288 e2e across chromium,
firefox, and webkit, plus one deliberate skip where Playwright's WebKit build ships no WebAudio
at all and the game correctly degrades to silence.

Three failures were fixed and none of them were in the app.

Ten of the thirteen were the machine, not the product. Playwright defaults to half the logical
cores, so six headless browsers were competing for the CPU while half this suite asserts on
real-time deadlines: the 180ms flip, the 1000ms flip-back, and a swap that has to land inside
the first half of a rotation. Firefox missed them and failed on context teardown timeouts, a
flip-back measured at 1185ms against a 1150ms ceiling, and a busy flag that never cleared.
Capping workers at three took the same suite from 13 failures to 1 with nothing else changed.
One retry is now allowed for a Firefox `browserContext.close` protocol fault that fires after
the test body has passed; Playwright reports that as flaky rather than passed, so it stays
visible.

The audio invariant failed on Chromium for a reason inside the recorder. It derived each cue's
duration by subtracting two scheduled times, and `at` and `at + seconds` do not subtract back to
`seconds`: the floating-point error depends on the size of the clock, so one 160ms buzz recorded
as 0.15999999999999992 and the next as 0.16000000000000014, and two identical cues looked like
two shapes. Rounded to the microsecond, which is four orders of magnitude finer than anything
audible. The assertion also names the shapes that diverged now, instead of only their count.

Rewrote `a real flip passes through the edge-on region`, which asked for a sampled frame within
0.35 of edge-on: a window about 20ms wide in a 180ms flip, or one frame of margin at 60fps.
Headless WebKit delivers requestAnimationFrame roughly every 130ms, so the flip was one or two
samples wide there and could not be observed at all. Proximity was only ever a proxy for the
real property, that the rotation *passes through* 90 degrees, and that is now asserted exactly
by the cosine changing sign, which the sibling linear-timing test turns into a proof rather than
an approximation. A second assertion requires intermediate angles to have been on screen, so a
card that snapped from 0 to 180 still fails, and that was verified by setting the flip to 0ms
and watching the test fail. This is a stricter assertion than the one it replaces.

Corrected the task file's definition of done, which asked for twenty-one e2e tests while its own
tables listed nineteen.

## 2026-08-04 01:58 EDT | docs(security): audit findings and SECURITY.md

Added `SECURITY.md`. Runtime is clean: `npm audit --omit=dev` reports 0, which is the expected
answer for an app with no runtime dependencies. Source review found no meaningful attack
surface, and the checks are recorded rather than summarized: no `innerHTML`, `eval`, `fetch`,
cookies, or inline handlers anywhere, every DOM write through `textContent` or `setAttribute`,
`localStorage` reads wrapped and range-checked, and no path by which parsed JSON reaches an
object merge.
Five advisories in the vitest/vite dev chain are recorded as knowingly deferred, not ignored.
Every one needs a dev server this project never starts, none are in the shipped artifact, and
the only offered fix is `npm audit fix --force`, which installs vitest 4, two majors up, with
163 unit tests riding on it. Recommended as its own deliberate task.
The shipping `?fm-test=1` and `&fm-rig=` hooks are recorded as accepted exposure with the
reasoning, after verifying rather than assuming the claim that mattered: the override is never
persisted, and `sanitizeRigLevel` clamps anything read back to 0 through 5, so pressing Reset
while it is active cannot raise the stored threshold.

## 2026-08-04 01:44 EDT | feat(security): enforce the no-network rule with a content security policy

SPEC.md §11 forbade runtime network calls, but only as a rule the code was trusted to keep. New
§11.1 makes it a property of the shipped page: `connect-src 'none'` refuses fetch, XHR,
WebSocket, and sendBeacon in the browser, so an analytics call or a CDN font fails instead of
passing review. It lives in `index.html` so it applies however the app is served, and
`scripts/serve.js` sends the whole policy as a response header as well, since `frame-ancestors`
is ignored in a meta tag by specification.
The app needed no relaxation to run under it. The only style write is
`canvas.style.imageRendering`, which is CSSOM and outside `style-src`, and that was confirmed by
running the suite rather than by asserting it.
Covered by 4 new tests on each engine. Two of them passed on first write and were fixed rather
than kept, per the rule that a test which passes before implementation is misspecified:
asserting that a third-party `fetch` rejects proves nothing, since it rejects anyway with no
route and no CORS, so it now waits for the `securitypolicyviolation` event that only a policy
fires; and the playthrough guard was anchored to the meta tag being present.
Removed the `eval` from `a11y.spec.js` as a prerequisite. The contrast helpers were a source
string eval'ed inside `page.evaluate`, which the policy refuses, and a test that needs `eval` is
testing a page that does not ship. Only the backdrop walk has to run in the page, so the color
math moved to the test process where both tests share one copy. The assertions are unchanged.

## 2026-08-04 01:12 EDT | test(e2e): make frame and cue sampling engine-independent

Back-filled entry for `2db580d`, which landed unlogged. Every frame-sampling helper waited a
fixed 400ms window, which is comfortable on Chromium and sometimes ends before WebKit has
turned the card. All three now wait until the flip is *observed* to reach face-on, with a 2s
ceiling. The edge-on check in `grid-and-flip.spec.js` reads the transform matrix rather than
the bounding rect, since Firefox reports a rect for a card rotated to exactly 90 degrees.
`integration.spec.js` compares request origins against `baseURL` rather than `page.url()`,
because the first request fires while the page is still `about:blank`, whose origin is `null`.
`reshuffle-silence.spec.js` skips its listener test where WebAudio is absent instead of
asserting over an empty recording. No assertion was loosened; each one was measuring the
wrong thing.

## 2026-08-04 01:11 EDT | test(e2e): run the suite on firefox and webkit

Back-filled entry for `732c444`. `playwright.config.js` gained named `firefox` and `webkit`
projects, taking the e2e suite from 92 tests to 276. The midpoint swap is the reason: it
depends on transition timing, which is the single most likely thing to vary between engines,
and a rig that holds only on Chromium is not a rig that holds.
Named projects change Playwright's snapshot path template, so the stall baseline is now three
per-engine images. They render text and CSS masks differently and there is no one correct
picture.

## 2026-08-04 01:10 EDT | fix(server): confine the dev server to loopback and the app tree

Back-filled entry for `21adcb8`. `scripts/serve.js` had three real problems: it listened on
every interface, making the whole checkout LAN-visible; it served dotfiles, so `/.git/config`
handed over the repository; and it normalized the request path before decoding it, so
`%2e%2e%2f` walked straight past the traversal guard as an opaque filename. It now binds
`127.0.0.1`, decodes before normalizing, uses a separator-aware containment check rather than
a bare `startsWith` (which also accepts a sibling directory sharing our prefix), and refuses
dotfiles below the root.
Covered by 7 new tests in `tests/e2e/server-hardening.spec.js`, green on all three engines.
The deliberate non-goal: traversal that resolves back *inside* the repo is still served, which
is what a static server for this directory is for. What must never happen is the walk
continuing past the root.

## 2026-08-04 01:09 EDT | fix(render): defer the card face wipe until the flip-back ends

Back-filled entry for `422203a`, and the more serious of the two bugs the cross-engine run
found. `backface-visibility: hidden` is not honored in this card stack on WebKit, so a card
that had been revealed kept showing its fruit while face down. Verified directly rather than
inferred: painting the hidden face changes rendered pixels on WebKit and does not on Chromium.
It was masked for most of the project because the renderer wiped the face the instant a card
went down, and removing that wipe in `4154fdc` is what surfaced it. The renderer now defers
the wipe until the flip-back has finished, which satisfies both: the fruit rotates away
naturally, and nothing is left on screen once the card settles.
This also closed a WebKit-only tell. Because the front face is always visible there, honest
reveals painted instantly while rigged ones painted half a flip later. Both phases now paint
on one deadline through a single `revealSecond` path, so only the choice of fruit differs.
Two task 18 timing tests were updated to the amended §7.1 contract, not weakened.

## 2026-08-04 01:08 EDT | docs(spec): treat the swap midpoint as a ceiling, not a target

Back-filled entry for `8d5672a`. Firefox was observed landing the swap *after* the face had
become readable, flashing one frame of an unpainted card. It never revealed the pre-swap
fruit, which is never drawn at all, but a card that flashes blank is its own tell.
Per `AGENTS.md` the spec was amended before the code. §7.1 now treats the midpoint as a
ceiling rather than a target, with the reasoning stated there: the front face is invisible for
the whole first half of the rotation, so swapping a frame early costs nothing while swapping a
frame late costs everything. `flipMidpoint` backs off by one frame and the swap races a timer
against a rAF loop.

## 2026-08-04 01:07 EDT | fix(a11y): stop cards blanking mid flip-back and repair contrast

Back-filled entry for `4154fdc`. A card cleared its face the instant it began rotating back,
so the fruit vanished a beat before the card turned away. The face now keeps its last sprite
while down, and every reveal repaints it while the card is still edge-on or further, so
nothing leaks.
Raised the control face to a paler sanded pine (`--fm-wood-pale`) so its ink label clears WCAG
AA at 6.7:1 rather than failing at 3.55:1, and gave focus a two-tone ring: a dark outline that
carries contrast on the pale controls, a light halo that carries it on the dark grid. One
color fails on one surface or the other, and the ring has to work everywhere it can land.

## 2026-08-03 05:39 EDT | feat(persistence): rigLevel persistence and the compounding curse (task 21)

Added the `fm.state` layer to `js/game.js` (`loadState`, `saveState`, and a clamp on `rigLevel`)
and wired the Reset button: each press decrements the threshold by one, floors at zero, and says
nothing about it. No confirmation, no warning, no hint that starting over costs anything.
Storage access is wrapped throughout, since private browsing can throw and a crash on load would
be a very loud tell. Corrupt JSON and out-of-range values fall back to the documented defaults
and overwrite. Board state is never written; a reload deals a fresh board at the stored level.
Kept the read-modify-write in this module rather than sharing a helper with `js/audio.js`. The
audio module's isolation is a hard constraint from SPEC.md §4.3, and a dozen duplicated lines is
the price of it not importing anything that could carry rig state.
Covered by 11 unit tests and 6 e2e including reload survival, a new browser context with the
same storage, and a standing no-escape guard that clicks every interactive element, hammers the
signboard, and tries the usual cheat codes. Full suite green: 163 unit, 66 e2e.

## 2026-08-03 05:35 EDT | feat(reshuffle): silent reshuffle and the tally invariant (task 20)

Added `buildEvenMultiset` and `silentReshuffle`, wired into the mismatch path after both cards
are face down and before the input lock is released, so no frame can show the board changing.
The multiset is regenerated from the outstanding pair count, never permuted from current values.
Verified that claim rather than asserting it: swapping in a permutation implementation fails
exactly the three tally tests and passes the other eight, which is the point of writing them.
Covered by 11 unit tests, including 200 randomized reroll and reshuffle cycles checked after
every single one, and 3 e2e proving the silence three ways: no oscillator constructed in the
reshuffle window, a pixel-identical grid across an attempt in which every hidden identity moved,
and the same 1000ms cycle time.

Two test corrections, both cases of an assertion outliving what the spec actually promises.
Task 18's `holds the first card for the whole attempt` ran past the end of the attempt, where
§7.3 hands every unmatched identity to the reshuffle; it now stops at the boundary. Task 19's
`commits the rerolled value` assumed the reroll could not return the card's own fruit, which
§7.2 permits, and was flaky in about one run in ten; it now pins the draw with an injected
random source. Neither assertion was weakened.
Also blurred the focus ring before the pixel comparison. It is a consequence of clicking, not of
the reshuffle. Full suite green: 152 unit, 60 e2e.

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
