# Task 13: 6x6 grid and card flip CSS

## Objective

Lay out the 36-card grid and build the 180ms Y-axis flip that the rig later hides inside.

## Depends on

11

## Spec reference

`SPEC.md` §2.1 (board), §2.3 (why 180ms and why the midpoint matters), §3.4 (card geometry),
§9 (responsive and reduced motion).

## Files created or modified

- `index.html` (modify: grid container and card markup)
- `css/style.css` (modify: grid and flip)
- `tests/e2e/grid-and-flip.spec.js` (new)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| `renders 36 cards` | Playwright | Exactly 36 card elements in the grid. Fails: no grid markup. |
| `grid is 6 by 6` | Playwright | Computed `grid-template-columns` resolves to six tracks, and the measured bounding boxes form six rows of six. |
| `cards are square` | Playwright | Every card's measured width equals its height within 1px. |
| `no horizontal scroll at 375px` | Playwright | At a 375px viewport, `document.scrollWidth <= clientWidth`. Direct check of `SPEC.md` §9. |
| `tap targets meet the minimum at 375px` | Playwright | Every card's measured width is at least 40px at the smallest supported viewport. |
| `cards have a front and a back face` | Playwright | Each card contains two face elements, both with `backface-visibility: hidden`, inside a parent with `transform-style: preserve-3d`. |
| **`flip duration is 180ms`** | Playwright | Computed `transition-duration` on the card is exactly `180ms`. Load-bearing: task 18 schedules the identity swap at t=90ms against this number. If the duration drifts, the swap lands off-midpoint and the visual channel reopens. |
| `flip uses rotateY` | Playwright | Applying the flipped state produces a computed transform matrix consistent with a Y-axis rotation, not opacity or a slide. |
| `card is unreadable at the midpoint` | Playwright | Sample the card mid-transition and assert the front face's rendered width is at or near zero. **This is the hiding place task 18 depends on.** Prove it exists before anything relies on it. |
| `bevel is inverted on locked cards` | Playwright | A card in the locked state has the recessed bevel (dark top and left) rather than the raised one, per `SPEC.md` §3.4. |
| **`reduced motion still flips`** | Playwright | With `prefers-reduced-motion: reduce` emulated, the transition duration is shorter but strictly greater than zero, and the rotateY still occurs. Encodes the §9 warning: killing the animation removes the only place the swap can hide and exposes the rig. |
| `touch-action is manipulation` | Playwright | Computed `touch-action` on cards is `manipulation`. |
| `cards are keyboard focusable` | Playwright | Every card is reachable by Tab and has a visible focus indicator. |

## Implementation notes

- `grid-template-columns: repeat(6, 1fr)` with `gap: clamp(2px, 1vw, 8px)` and
  `aspect-ratio: 1` on the cards.
- The 180ms duration should be a CSS custom property, and task 18 should read it rather than
  hardcoding 90. That keeps the swap aligned to the midpoint if the duration is ever tuned.
- Under reduced motion, shorten the duration via the same custom property so the midpoint
  stays proportional and task 18 needs no special case.
- No hover-only affordances anywhere (`SPEC.md` §9). Focus and active states must carry
  everything hover does.
- Cards are inert in this task. Clicking does nothing until task 16.

## Definition of done

- All thirteen E2E tests green, especially the 180ms duration and the midpoint-unreadable test.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
