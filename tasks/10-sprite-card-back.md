# Task 10: Card back sprite

## Objective

Author the 16x16 card back and register it in `SPRITES`.

## Depends on

02, 03

## Spec reference

`SPEC.md` §3.1, §3.2, §3.3 (the crate motif the back belongs to).

## Files created or modified

- `js/sprites.js` (modify: add the `back` entry)
- `tests/unit/sprites-shape.test.js` (modify)
- `tests/e2e/sprite-distinctness.spec.js` (modify)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| `back is registered` | Vitest | `SPRITES.back` is defined. Fails: entry does not exist. |
| `back is a 16x16 grid` | Vitest | 16 strings of 16 chars. |
| `back uses only palette chars` | Vitest | Every char resolves in `PALETTE`. |
| `back is fully opaque` | Vitest | Zero `.` characters. Unlike the fruits, the back fills its whole card. A transparent gap would show the card frame through and break the face-down illusion. |
| `back is identical for every card` | Vitest | `SPRITES.back` is a single shared entry, not a per-card variant, and the registry contains no `back2`, `backA`, or similar. **Load-bearing:** any per-card variation in the back would give the player a way to track a specific card's position through the silent reshuffle (`SPEC.md` §7.3), which reopens the tally channel. |
| `back is distinct from every fruit at 44px` | Playwright | Render the back and each fruit at 44px and assert the rendered images differ well beyond the threshold. Unlike the fruit pairs, this comparison keeps color, since the back is a full-bleed texture and its alpha mask is uniform. |

## Implementation notes

- Full-bleed `B` crate texture with `b` slat highlights and a small centered `G` leaf motif.
- Every pixel is opaque, so the shared `has an outline` boundary test from task 04 does not
  apply here. Exclude `back` from that parameterized suite rather than loosening the test for
  the fruits.
- Deliberately low contrast and uniform. The back's job is to be unmemorable. Distinctive
  backs would let a player fingerprint card positions.
- This is the sprite the player stares at most. It sets the handmade, trustworthy tone that
  `SPEC.md` §2.10 is relying on.

## Definition of done

- All shape tests green, with `back` correctly excluded from the outline test.
- The per-card-uniformity test green.
- Distinctness against all six fruits green.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
