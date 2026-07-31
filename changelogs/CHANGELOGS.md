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
