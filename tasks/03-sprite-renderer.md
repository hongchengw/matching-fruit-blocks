# Task 03: Sprite renderer

## Objective

Provide `drawSprite(canvas, name)`, which paints a 16x16 char-grid sprite onto a canvas at
native pixel resolution.

## Depends on

01, 02

## Spec reference

`SPEC.md` §3.2 (sprite grid convention).

## Files created or modified

- `js/sprites.js` (new: the `SPRITES` registry and the renderer)
- `tests/unit/sprite-renderer.test.js` (new)
- `tests/e2e/sprite-render.spec.js` (new)

## Tests to write first

Use one throwaway fixture sprite defined in the test file, not a real fruit. Real fruits
arrive in tasks 04 through 10 and this task must be testable before any of them exist.

| Test | Runner | Assertion |
|---|---|---|
| `exports drawSprite and a SPRITES registry` | Vitest | Both are defined; `SPRITES` is an object. Fails: module does not exist. |
| `sets canvas to 16x16 internal resolution` | Vitest, canvas mock | After `drawSprite`, `canvas.width === 16 && canvas.height === 16`, regardless of the canvas's CSS display size. |
| `clears before drawing` | Vitest, canvas mock | `clearRect(0, 0, 16, 16)` is called before the first `fillRect`. Without this, a rigged swap would paint the new fruit over the old one and leave artifacts. |
| `fills one 1x1 rect per opaque pixel` | Vitest, canvas mock | For a fixture with a known count of non-`.` chars, `fillRect` is called exactly that many times, always with width and height of 1. |
| `skips transparent pixels` | Vitest, canvas mock | No `fillRect` is issued at any coordinate whose fixture char is `.`. |
| `maps chars to palette colors` | Vitest, canvas mock | `fillStyle` at a known coordinate equals `PALETTE[char]` for that coordinate. Proves the renderer reads the palette rather than hardcoding. |
| `throws on an unknown sprite name` | Vitest | `drawSprite(canvas, 'nope')` throws. A silent no-op would show a blank card and read as a rendering bug during the rigged phase. |
| `throws on a char missing from the palette` | Vitest | A fixture containing an unmapped char throws rather than painting black. |
| `renders pixelated when scaled up` | Playwright | Draw the fixture to a canvas displayed at 8x size, probe two adjacent device pixels inside one logical pixel, and assert they are the same color. Proves `image-rendering: pixelated` is in effect and the browser is not smoothing. |
| `probes the expected color at a known coordinate` | Playwright | `getImageData` at a fixture coordinate returns the palette RGB for that char. jsdom cannot verify real rasterization, so this is the browser-side truth check. |

## Implementation notes

- Internal resolution is always 16x16. Display size is entirely a CSS concern. Never scale
  the drawing context to fit a larger canvas; that reintroduces smoothing.
- `image-rendering: pixelated` belongs on the canvas element. The renderer should set it (or
  task 11's CSS should, but one of them must own it and this test pins the behavior here).
- Validate the sprite grid shape on read: 16 strings of 16 chars. A malformed sprite should
  throw at draw time with the sprite name in the message.
- Keep the renderer pure with respect to game state. It takes a canvas and a name and paints.
  It knows nothing about cards, matches, or the rig.
- The `SPRITES` registry starts empty (or with only what tasks 04-10 add). Do not stub fruit
  entries here; that would make tasks 04-10 pass before they are implemented.

## Definition of done

- All eight unit tests and both E2E tests green.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
