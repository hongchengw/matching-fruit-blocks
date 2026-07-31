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
