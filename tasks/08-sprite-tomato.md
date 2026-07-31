# Task 08: Tomato sprite

## Objective

Author the 16x16 tomato sprite and register it in `SPRITES`, keeping it clearly distinct from
the apple.

## Depends on

02, 03, **04** (the apple must exist so the distinctness test has something to fail against)

## Spec reference

`SPEC.md` §3.1, §3.2. Note the explicit callout: "Apple and tomato are the highest-risk pair
and must differ clearly in outline, not merely in shading."

## Files created or modified

- `js/sprites.js` (modify: add the `tomato` entry)
- `tests/unit/sprites-shape.test.js` (modify)
- `tests/e2e/sprite-distinctness.spec.js` (modify)

## Tests to write first

Same shape suite as task 04, parameterized over `tomato`, plus one dedicated test for the
risky pair:

| Test | Runner | Assertion |
|---|---|---|
| `tomato is registered` | Vitest | `SPRITES.tomato` is defined. Fails: entry does not exist. |
| `tomato is a 16x16 grid` | Vitest | 16 strings of 16 chars. |
| `tomato uses only palette chars` | Vitest | Every char resolves in `PALETTE`. |
| `tomato is not blank` | Vitest | At least 40 opaque pixels. |
| `tomato has an outline` | Vitest | Boundary pixels are `K`. |
| `tomato renders at 44px` | Playwright | Opaque pixel count within tolerance after downscale. |
| `every pair of sprites is distinct at 44px` | Playwright | Tomato vs every other registered sprite. |
| **`tomato and apple differ by silhouette alone`** | Playwright | Render both at 44px, reduce each to a binary alpha mask discarding all color, and assert the masks differ by more than the standard threshold. **Color is deliberately thrown away.** Two red round things that differ only in hex value would fail a colorblind player and would fail at a glance. |

That last test is the point of this task. Write it first and watch it fail against a
placeholder tomato that is just a recolored apple, to confirm the test actually discriminates.

## Implementation notes

- `R` body with `r` highlight, `K` outline, but the silhouette must diverge from the apple:
  - Wider than tall, slightly squat, with a flatter bottom than the apple's round base.
  - A five-point `G` calyx star sitting flat on the top, spreading horizontally.
  - **No stem-and-single-leaf arrangement.** That silhouette belongs to the apple (task 04).
- If the distinctness test sits near the threshold, change the outline, not the shading.
  Widening the calyx or flattening the base moves the mask. Darkening the red does not.

## Definition of done

- Shape suite green for tomato.
- The dedicated apple/tomato silhouette test green, and verified to fail against a recolored
  apple.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
