# Task 11: HTML skeleton and base CSS

## Objective

Create `index.html` and the base `css/style.css`: document structure, color variables, bevel
primitives, and typography.

## Depends on

01

## Spec reference

`SPEC.md` §3.3 (stall anatomy, structure only), §3.4 (bevel geometry), §3.5 (typography),
§11 (no build step, no network requests).

## Files created or modified

- `index.html` (new)
- `css/style.css` (new)
- `tests/e2e/page-structure.spec.js` (new)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| `page loads without console errors` | Playwright | Navigate to `/`, assert zero `console.error` and zero page errors. Fails: no `index.html`. |
| `has the five stall regions` | Playwright | Elements for awning, signboard, scoreboard, grid area, and base are all present in the DOM in that document order. Structure only; task 12 styles them. |
| **`makes no network requests beyond same-origin app files`** | Playwright | Intercept all requests. Every one resolves to the local origin and the set is limited to the HTML, CSS, and JS the app owns. **Zero requests to any font host, CDN, or third party.** Enforces `SPEC.md` §3.5 and §11 before any later task can casually add a Google Fonts link. |
| `declares a monospace fallback` | Playwright | The computed `font-family` on `body` ends in a generic `monospace`. If an embedded pixel font is added later it must still fall back. |
| `text is uppercase and letter-spaced` | Playwright | Computed `text-transform` is `uppercase` and `letter-spacing` is non-zero on the scoreboard region. |
| `bevel primitive renders raised` | Playwright | An element with the bevel class has a lighter computed `border-top-color` and `border-left-color` than its `border-bottom-color` and `border-right-color`. Encodes the light-from-top-left rule of `SPEC.md` §3.4 so later tasks cannot flip it. |
| `bevel is 3px` | Playwright | Computed border width on the bevel primitive is `3px` on all sides. |
| `color variables are defined` | Playwright | The documented CSS custom properties resolve to non-empty values on `:root`. |
| `scripts load as ES modules` | Playwright | Every `<script>` tag carries `type="module"`. `SPEC.md` §11 forbids a bundler, so the browser must resolve the module graph itself. |

## Implementation notes

- Semantic containers with stable ids or data attributes. Later tasks target these, so
  renaming them is a breaking change across tasks 12, 13, 16, 17, and 21.
- CSS custom properties on `:root` for the palette-adjacent chrome colors. The sprite palette
  lives in `js/palette.js` (task 02) and is separate; do not duplicate hex values across both.
  Chrome colors and sprite colors are different concerns.
- The bevel is a reusable class, not a per-component style. Cards (task 13), the scoreboard
  (task 17), and the reset button all use it.
- No `<link>` to any external host, ever. If a pixel font is used it is base64-inlined in the
  stylesheet or self-hosted from the repo.
- No JS behavior in this task. Structure and style only.

## Definition of done

- All nine E2E tests green, especially the network-request test.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
