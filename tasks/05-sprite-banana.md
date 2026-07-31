# Task 05: Banana sprite

## Objective

Author the 16x16 banana sprite and register it in `SPRITES`.

## Depends on

02, 03

## Spec reference

`SPEC.md` §3.1, §3.2.

## Files created or modified

- `js/sprites.js` (modify: add the `banana` entry)
- `tests/unit/sprites-shape.test.js` (modify: add banana to the shared shape suite)
- `tests/e2e/sprite-distinctness.spec.js` (modify: banana joins the pairwise comparison)

## Tests to write first

Same six-test shape suite as task 04, parameterized over `banana`:

| Test | Runner | Assertion |
|---|---|---|
| `banana is registered` | Vitest | `SPRITES.banana` is defined. Fails: entry does not exist. |
| `banana is a 16x16 grid` | Vitest | 16 strings of 16 chars. |
| `banana uses only palette chars` | Vitest | Every char resolves in `PALETTE`. |
| `banana is not blank` | Vitest | At least 40 opaque pixels. |
| `banana has an outline` | Vitest | Boundary pixels are `K`. |
| `banana renders at 44px` | Playwright | Opaque pixel count within tolerance after downscale. |
| `every pair of sprites is distinct at 44px` | Playwright | Now compares banana against apple. Must exceed the silhouette difference threshold. |

## Implementation notes

- Crescent, `Y` base with `y` highlight along the inner curve, `K` outline, small `B` tip.
- The crescent is the strongest silhouette in the set and is the reference the other five are
  measured against. Keep the curve pronounced; a nearly straight banana reads as a carrot at
  44px.

## Definition of done

- Shape suite green for banana, distinctness suite green for the apple/banana pair.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
