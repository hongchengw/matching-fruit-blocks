# Task 04: Apple sprite

## Objective

Author the 16x16 apple sprite and register it in `SPRITES`.

## Depends on

02, 03

## Spec reference

`SPEC.md` §3.1 (palette), §3.2 (grid convention and the 44px silhouette requirement).

## Files created or modified

- `js/sprites.js` (modify: add the `apple` entry)
- `tests/unit/sprites-shape.test.js` (new: shared shape suite, created by this task and
  extended by tasks 05 through 10)
- `tests/e2e/sprite-distinctness.spec.js` (new: shared distinctness suite, likewise extended)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| `apple is registered` | Vitest | `SPRITES.apple` is defined. Fails: entry does not exist. |
| `apple is a 16x16 grid` | Vitest | Exactly 16 strings, each exactly 16 characters. |
| `apple uses only palette chars` | Vitest | Every character resolves in `PALETTE`. |
| `apple is not blank` | Vitest | At least 40 non-`.` pixels. A grid of all dots would pass every other shape test while rendering an empty card. |
| `apple has an outline` | Vitest | Uses the outline key `K`, and every opaque pixel on the shape's outer boundary is `K`. Sprites without a closed outline read as mush at 44px. |
| `apple renders at 44px` | Playwright | Draw at 44px display size and assert the opaque pixel count is within a documented tolerance of the source grid's ratio. Catches sprites that vanish when scaled down. |

The shared distinctness test in `tests/e2e/sprite-distinctness.spec.js` starts here with a
single entry and grows as tasks 05 through 10 land:

| Test | Runner | Assertion |
|---|---|---|
| `every pair of sprites is distinct at 44px` | Playwright | For each pair of registered sprites, render both at 44px, compare their alpha masks, and assert the silhouettes differ by more than a documented threshold. With only apple registered this is vacuously true; it becomes the real gate in task 08. |

## Implementation notes

- Round body, `R` base with an `r` highlight on the upper left, `K` outline, `B` stem, `G`
  leaf off the stem to the right.
- The leaf and stem are the apple's silhouette signature. Task 08 (tomato) must not reuse
  that arrangement, so keep the leaf clearly asymmetric and clearly attached.
- Leave a 1px transparent margin on all four sides so the sprite does not touch the card
  bevel.

## Definition of done

- All six unit tests and both E2E tests green.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
