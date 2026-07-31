# Task 02: Earth-tone palette

## Objective

Define the single char-keyed color palette that every sprite in the game draws from.

## Depends on

01

## Spec reference

`SPEC.md` §3.1 (palette table and roles).

## Files created or modified

- `js/palette.js` (new)
- `tests/unit/palette.test.js` (new)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| `exports a palette object` | Vitest | `PALETTE` is a plain object with at least 12 entries. Fails: module does not exist. |
| `every value is a valid hex color` | Vitest | Every value matches `/^#[0-9a-f]{6}$/i`. Catches typos and shorthand hex. |
| `dot is transparent` | Vitest | `PALETTE['.']` is `null` (or the module's documented transparent sentinel), never a color string. The renderer relies on this to skip pixels. |
| `covers every role in the spec` | Vitest | Keys include at minimum `K R r O o Y y G g B b W` plus `.`. Fails if a role from `SPEC.md` §3.1 is missing. |
| `colors are distinguishable` | Vitest | No two non-transparent entries are the same hex value. Two identical colors would make a sprite's shading invisible. |
| `palette is earth-toned` | Vitest | Every non-transparent color has saturation below a documented ceiling and hue outside the blue/violet range once converted to HSL. Encodes the brief from `SPEC.md` §3.1 so nobody drops a neon accent in later. |

## Implementation notes

- Export a frozen object. The palette is read by the renderer on every draw and must not be
  mutated at runtime.
- Keep the transparent sentinel explicit and documented in a comment. The renderer skips on
  it, so a stray empty string or `undefined` would silently paint black.
- Uppercase and lowercase keys are distinct: uppercase is the base tone, lowercase is its
  lighter highlight (`SPEC.md` §3.1).
- Choose values against the brief in `SPEC.md` §2.10: warm, handmade, market-stall. The
  chrome's trustworthiness is doing psychological work.

## Definition of done

- All six unit tests green.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
