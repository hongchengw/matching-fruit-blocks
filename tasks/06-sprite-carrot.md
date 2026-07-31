# Task 06: Carrot sprite

## Objective

Author the 16x16 carrot sprite and register it in `SPRITES`.

## Depends on

02, 03

## Spec reference

`SPEC.md` §3.1, §3.2.

## Files created or modified

- `js/sprites.js` (modify: add the `carrot` entry)
- `tests/unit/sprites-shape.test.js` (modify)
- `tests/e2e/sprite-distinctness.spec.js` (modify)

## Tests to write first

Same shape suite as task 04, parameterized over `carrot`:

| Test | Runner | Assertion |
|---|---|---|
| `carrot is registered` | Vitest | `SPRITES.carrot` is defined. Fails: entry does not exist. |
| `carrot is a 16x16 grid` | Vitest | 16 strings of 16 chars. |
| `carrot uses only palette chars` | Vitest | Every char resolves in `PALETTE`. |
| `carrot is not blank` | Vitest | At least 40 opaque pixels. |
| `carrot has an outline` | Vitest | Boundary pixels are `K`. |
| `carrot renders at 44px` | Playwright | Opaque pixel count within tolerance after downscale. |
| `every pair of sprites is distinct at 44px` | Playwright | Carrot vs apple and banana. |

## Implementation notes

- Downward-tapering `O` triangle with `o` highlight stripes, `K` outline, `G` frond tuft at
  the top.
- The taper is the signature. Its widest point is at the top and it comes to a near-point at
  the bottom, which is what separates it from the banana crescent at small size.
- Pumpkin (task 09) also uses `O`. Carrot and pumpkin must differ by silhouette, not by hue,
  since the distinctness test compares alpha masks and ignores color entirely.

## Definition of done

- Shape suite green for carrot, distinctness suite green for all registered pairs.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
