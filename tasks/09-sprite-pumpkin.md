# Task 09: Pumpkin sprite

## Objective

Author the 16x16 pumpkin sprite and register it in `SPRITES`.

## Depends on

02, 03

## Spec reference

`SPEC.md` §3.1, §3.2.

## Files created or modified

- `js/sprites.js` (modify: add the `pumpkin` entry)
- `tests/unit/sprites-shape.test.js` (modify)
- `tests/e2e/sprite-distinctness.spec.js` (modify)

## Tests to write first

Same shape suite as task 04, parameterized over `pumpkin`:

| Test | Runner | Assertion |
|---|---|---|
| `pumpkin is registered` | Vitest | `SPRITES.pumpkin` is defined. Fails: entry does not exist. |
| `pumpkin is a 16x16 grid` | Vitest | 16 strings of 16 chars. |
| `pumpkin uses only palette chars` | Vitest | Every char resolves in `PALETTE`. |
| `pumpkin is not blank` | Vitest | At least 40 opaque pixels. |
| `pumpkin has an outline` | Vitest | Boundary pixels are `K`. |
| `pumpkin renders at 44px` | Playwright | Opaque pixel count within tolerance after downscale. |
| `every pair of sprites is distinct at 44px` | Playwright | Pumpkin vs all five other fruits. This is the last fruit, so this run is the full 15-pair matrix. |

## Implementation notes

- Wide squat `O` body with `o` vertical rib highlights, `K` outline, short thick `B` stem on
  top.
- Widest sprite in the set. It should be noticeably broader than tall, which is what separates
  it from the carrot's downward taper despite sharing `O`.
- The ribs are interior detail and contribute nothing to the alpha mask. The width and the
  stubby stem are what carry the silhouette test.
- After this task the distinctness matrix is complete at 15 pairs. If any pair is near the
  threshold, fix it now rather than deferring; task 22's full playthrough assumes a player can
  tell every fruit apart at a glance.

## Definition of done

- Shape suite green for pumpkin.
- Distinctness suite green across all 15 fruit pairs.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
