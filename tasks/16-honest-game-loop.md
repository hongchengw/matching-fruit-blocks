# Task 16: Honest game loop

## Objective

Make the game playable and fair: flip handling, match locking, the 1000ms mismatch flip-back,
and the input lock.

## Depends on

03, 13, 14, 15

## Spec reference

`SPEC.md` §5 (state model), §6 (honest phase behavior in full).

## Files created or modified

- `js/game.js` (modify: state machine and flip handler)
- `index.html` (modify: wire the module)
- `tests/unit/game-loop.test.js` (new)
- `tests/e2e/honest-play.spec.js` (new)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| `initial state matches the model` | Vitest | `first` is null, `matches` is 0, `busy` is false, 36 cards down. Fails: no state machine. |
| `first flip reveals the true fruit` | Vitest | The card's revealed fruit equals its deck fruit, state becomes `'up'`, `lastShown` is set, `first` holds its id. |
| `second flip compares against the first` | Vitest | With two known cards, a matching pair and a mismatching pair each produce the right branch. |
| `match locks both cards` | Vitest | Both states become `'locked'`, `matches` increments by 1, `first` returns to null. |
| `locked cards never flip back` | Vitest | After a match, further clicks on either card are no-ops and their state stays `'locked'`. |
| **`mismatch flips back after exactly 1000ms`** | Vitest, fake timers | At 999ms both cards are still `'up'`; at 1000ms both are `'down'`. `SPEC.md` §6 fixes this number and §7 requires the rigged phase to match it exactly, so it is pinned here. |
| `busy locks input during the mismatch delay` | Vitest | Clicks on any card during the 1000ms window change nothing. |
| `busy is released after flip-back` | Vitest | `busy` is false once the flip-back completes and the next flip is accepted. |
| `clicking an already-up card is a no-op` | Vitest | Clicking the first card again does not resolve the attempt or set `busy`. |
| `flip cue fires on every reveal` | Vitest | `beepFlip` is called once per card revealed. |
| `match and mismatch cues fire on the right branch` | Vitest | `beepMatch` on a match, `beepMismatch` on a mismatch, never both. |
| `plays a real match end to end` | Playwright | Reveal the board via a test hook, click a true pair, and assert both stay face up and the score advances. |
| `plays a real mismatch end to end` | Playwright | Click a non-pair, assert both flip back after the delay and nothing is locked. |
| `rapid clicks during the delay are ignored` | Playwright | Click six cards fast during a mismatch window and assert only the original two ever flipped. Real-browser check that the `busy` lock survives event timing. |
| **`the honest phase is genuinely winnable`** | Playwright | With the rig disabled, play 18 correct pairs using known positions and assert all 36 cards lock and `matches` reaches 18. Proves the base game is fair, which is what tasks 18 through 20 later take away. Without this, a broken match check would be indistinguishable from the rig. |

## Implementation notes

- The flip handler is the one place clicks enter the system. Keep the guard conditions
  (`busy`, `up`, `locked`) at its top and never duplicate them elsewhere.
- Do not implement `rigged`, `rerollFruit`, or `silentReshuffle` here. Task 16 must be a fully
  fair game. Tasks 18 through 20 layer the rig on top of this loop without changing its shape,
  which is what makes the rigged and honest timings identical for free.
- The mismatch path will later call `silentReshuffle` (task 20). Leave the call site obvious
  but do not stub the function; a stub would let task 20's tests pass early.
- Expose a minimal test hook for E2E (reading card fruits, forcing a deck) behind a flag or a
  documented debug export. Playwright cannot otherwise know where the pairs are. Keep it out
  of the player-facing UI.
- `js/game.js` should stay readable as: pure deck helpers (task 15), then state, then the flip
  handler. Push rendering into small functions at the edges.

## Definition of done

- All eleven unit tests and four E2E tests green, especially the winnability test.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
