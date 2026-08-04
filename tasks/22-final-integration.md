# Task 22: Final integration

## Objective

Verify the whole game end to end across viewports and input methods, and confirm all four
sealed channels hold together in a real playthrough.

## Depends on

All tasks 01 through 21.

## Spec reference

`SPEC.md` §9 (responsive and accessibility), §10.3 (the four invariants), §11 (non-goals).

## Files created or modified

- `css/style.css` (modify: responsive and a11y fixes surfaced by these tests)
- `tests/e2e/integration.spec.js` (new)
- `tests/e2e/a11y.spec.js` (new)

## Tests to write first

Every test below fails against an empty repo, and all of them fail until tasks 01 through 21
are green, since each one drives the assembled game rather than any single unit.

### Full playthrough

| Test | Runner | Assertion |
|---|---|---|
| **`the honest phase then the wall`** | Playwright | Play 5 honest matches using the test hook, then 20 rigged attempts. Assert: all 5 honest matches locked, and **not one of the 20 rigged attempts succeeded**. |
| **`all four invariants hold across the playthrough`** | Playwright | During that same run, continuously assert: no frame shows a pre-swap fruit face-on (visual), every mismatch cue is identical (audio), every unmatched fruit count stays even (tally), and `rigLevel` persists correctly (persistence). The combined form of `SPEC.md` §10.3. |
| `the game never ends` | Playwright | After 50 rigged attempts there is no win screen, no game-over screen, no modal, and no state change beyond the board reshuffling. Confirms the non-goals in §11. |
| `the counter stayed frozen throughout` | Playwright | The scoreboard read `5/18` at every sampled point after the rig armed. |
| `a full curse cycle` | Playwright | Play to the wall, reset, and repeat six times. Assert the honest phase shortens 5, 4, 3, 2, 1, 0 and that the sixth run is rigged from the first click. |

### Responsive

| Test | Runner | Assertion |
|---|---|---|
| `renders across viewports` | Playwright | At 375px, 768px, 1024px, and 1440px: no horizontal scroll, all 36 cards visible without scrolling the grid, and every stall region present. |
| `cards stay square at every width` | Playwright | Width equals height within 1px at every tested viewport. |
| `tap targets hold at the smallest viewport` | Playwright | Every card is at least 40px at 375px, per `SPEC.md` §9. |
| `sprites stay legible at the smallest card size` | Playwright | Render every fruit at the 375px card size and re-run the pairwise distinctness check from tasks 04 through 10. The silhouettes must still discriminate at the size the game actually ships at. |

### Touch and accessibility

| Test | Runner | Assertion |
|---|---|---|
| `plays fully by touch` | Playwright, touch emulation | A complete match and a complete mismatch resolve using tap events only. |
| `no double-tap zoom` | Playwright | Computed `touch-action` is `manipulation` on all interactive elements. |
| `no hover-only affordances` | Playwright | With hover unavailable, every interactive element still exposes its state through focus or active styling. `SPEC.md` §9. |
| `fully keyboard playable` | Playwright | Tab reaches every card, Enter and Space activate, and a full match can be made without a mouse. |
| `focus is always visible` | Playwright | Every focusable element has a visible focus indicator meeting a documented contrast ratio. |
| `contrast passes` | Playwright | Scoreboard digits, button labels, and price tag text meet WCAG AA against their backgrounds. |
| `reduced motion end to end` | Playwright | With `prefers-reduced-motion: reduce`, play through the phase boundary and confirm the game is still playable **and the rig is still hidden**. The §9 warning, verified in a real playthrough rather than in isolation. |

### Regression sweep

| Test | Runner | Assertion |
|---|---|---|
| `no console errors during a long session` | Playwright | Zero errors across the 50-attempt run. |
| `no runtime network requests` | Playwright | Across the full session, every request is same-origin and limited to app files. Re-confirms task 11 after every later task has touched the page. |
| `no memory growth over a long session` | Playwright | Listener and node counts are stable after 50 attempts. Fifty reshuffles that each leak a listener would eventually degrade the timing, and timing is a detection channel. |

## Implementation notes

- This task adds no features. If a test here fails, the fix belongs in the task that owns that
  behavior. Fix it there, then re-run. Only responsive and a11y polish lands in this task's own
  diff.
- The playthrough tests need the test hook from task 16 to know where the true pairs are.
  Confirm the hook is not reachable from the player-facing UI.
- Run the suite on more than one browser engine if the Playwright config supports it. The
  midpoint swap depends on transition timing, which is the most likely thing to vary.
- When this task is green the game is done. There is no task 23, and no win screen is coming.

## Definition of done

- All nineteen E2E tests green. (The tables above list nineteen: 5 playthrough, 4 responsive,
  7 touch and accessibility, 3 regression sweep. This line said twenty-one, which was an
  arithmetic slip and never matched the tables it was counting.)
- Full suite green across every configured browser.
- All four invariants from `SPEC.md` §10.3 verified in a single combined playthrough.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
