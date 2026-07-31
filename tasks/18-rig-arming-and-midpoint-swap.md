# Task 18: Rig arming and the midpoint swap

## Objective

Arm the rig at the `rigLevel` threshold and swap the second card's sprite at the flip's 90deg
edge-on midpoint. **Seals the visual detection channel.**

## Depends on

13, 16

## Spec reference

`SPEC.md` §2.2, §2.3 (decisions), §5 (`rigged` is derived), §7.1 (the implementation
constraint), §10.3 (the visual invariant).

## Files created or modified

- `js/game.js` (modify: `rigged` getter and the swap scheduling)
- `tests/unit/rig-arming.test.js` (new)
- `tests/e2e/midpoint-swap.spec.js` (new)

## Tests to write first

Task 19 owns which fruit the reroll picks. This task owns only **when** the swap happens. Use
a stub reroll that returns a fixed non-matching fruit so the two concerns stay separable.

| Test | Runner | Assertion |
|---|---|---|
| `rigged is false below the threshold` | Vitest | With `rigLevel` 5 and `matches` 0 through 4, `rigged` is false. Fails: no getter. |
| `rigged is true at and above the threshold` | Vitest | At `matches` 5 and above, `rigged` is true. Boundary is inclusive per `SPEC.md` §5. |
| **`rigged is derived, not stored`** | Vitest | Setting `matches` directly flips `rigged` with no other call. There is no settable `rigged` flag anywhere in state. A stored flag could drift out of sync and produce an accidentally winnable board. |
| `rigged is true from the first attempt at rigLevel 0` | Vitest | With `rigLevel` 0 and `matches` 0, `rigged` is true. The end state task 21 drives toward. |
| `first card is never rerolled` | Vitest | While rigged, the first card of an attempt reveals its true deck fruit. Encodes the reroll-scope decision in `SPEC.md` §2.4. |
| `first card holds for the whole attempt` | Vitest | The first card's fruit is unchanged after the second card resolves. |
| `second card is rerolled only when rigged` | Vitest | Honest phase: the second card shows its true fruit. Rigged: the reroll stub is consulted. |
| `swap is scheduled at the flip midpoint` | Vitest, fake timers | The swap fires at half the configured flip duration, read from the CSS custom property set in task 13 rather than hardcoded as 90. |
| **`swap does not use transitionend`** | Vitest | No `transitionend` listener is registered on the card during a rigged reveal. `SPEC.md` §7.1 forbids it: it fires after the card is face-on again, which guarantees a visible pre-swap frame. |
| **`no frame shows the pre-swap fruit face-on`** | Playwright | Drive a rigged second-card reveal while capturing frames at a fine interval through the whole flip. For every frame, either the card is past 90deg and unreadable, or the visible sprite is the post-swap fruit. **Zero frames may show the true fruit at a readable rotation. This is the visual invariant from `SPEC.md` §10.3.** |
| `swap is invisible at normal speed` | Playwright | Screenshot immediately before and after the transition and assert no intermediate visual artifact, tear, or flicker is present. |
| **`reduced motion preserves the hiding place`** | Playwright | With `prefers-reduced-motion: reduce`, repeat the frame-by-frame assertion. The shortened flip must still hide the swap, since task 13 keeps the rotation and this task derives the midpoint from the duration. |
| `rigged timing is identical to honest timing` | Playwright | Measure wall-clock time from second-card click to flip-back completion in both phases and assert they match within a tight tolerance. Timing is a detection channel too: a rigged attempt that takes noticeably longer would be a tell. |

## Implementation notes

- Read the flip duration from the CSS custom property task 13 defines, halve it, and schedule
  against that. Hardcoding 90 breaks silently if the duration is ever tuned, and breaks
  entirely under reduced motion.
- Never draw the true fruit and then replace it. Decide the identity at the midpoint and draw
  once. Drawing twice is what produces the pre-swap frame the invariant forbids.
- Call the reroll through a seam task 19 can fill. This task ships with a deliberately dumb
  stub; do not implement the real selection rules here.
- The mismatch that follows must go down the exact same code path as an honest mismatch: same
  1000ms delay, same `beepMismatch`, same flip-back. Any divergence is a tell. Task 14 already
  guarantees the audio side structurally.

## Definition of done

- All nine unit tests and four E2E tests green, especially the frame-by-frame invariant under
  both normal and reduced motion.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
