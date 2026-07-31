# Task 07: Corn sprite

## Objective

Author the 16x16 corn sprite and register it in `SPRITES`.

## Depends on

02, 03

## Spec reference

`SPEC.md` §3.1, §3.2.

## Files created or modified

- `js/sprites.js` (modify: add the `corn` entry)
- `tests/unit/sprites-shape.test.js` (modify)
- `tests/e2e/sprite-distinctness.spec.js` (modify)

## Tests to write first

Same shape suite as task 04, parameterized over `corn`:

| Test | Runner | Assertion |
|---|---|---|
| `corn is registered` | Vitest | `SPRITES.corn` is defined. Fails: entry does not exist. |
| `corn is a 16x16 grid` | Vitest | 16 strings of 16 chars. |
| `corn uses only palette chars` | Vitest | Every char resolves in `PALETTE`. |
| `corn is not blank` | Vitest | At least 40 opaque pixels. |
| `corn has an outline` | Vitest | Boundary pixels are `K`. |
| `corn renders at 44px` | Playwright | Opaque pixel count within tolerance after downscale. |
| `every pair of sprites is distinct at 44px` | Playwright | Corn vs apple, banana, carrot. |

## Implementation notes

- Upright `Y` cob with a `y` kernel checker pattern, `K` outline, `G` husk leaves flaring
  down and out from both sides at the base.
- The flared husk is the silhouette signature. Corn shares `Y` with banana, so the outline
  has to carry the difference: banana is a horizontal crescent, corn is a vertical capsule
  with wings.
- Keep the kernel checker at 1px granularity. Larger blocks turn to mud when downscaled and
  the cob loses its texture read.

## Definition of done

- Shape suite green for corn, distinctness suite green for all registered pairs.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
