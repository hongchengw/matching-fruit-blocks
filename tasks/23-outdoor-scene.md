# Task 23: Move the stall outdoors

## Objective

Put the fruit stand on the outskirts of a farm under a clear blue sky, in the same pixel idiom
as everything else. The game is unchanged; only the scene around it grows.

## Depends on

11, 12, 22

## Spec reference

`SPEC.md` §2.9 (pixel art), §2.10 (chrome and the warmth rationale), §3.1 (palette), §3.3 (stall
anatomy), §3.5, §9, §11.

**Amend the spec before writing any CSS.** Two clauses forbid this task as written:

- §3.1 caps the palette at "roughly 12 earth tones". Sky blue and field green are neither. Add a
  small, named environment group rather than loosening the earth-tone brief that governs the
  sprites, which do not change.
- §2.10 requires warm tones. Scope it: warmth governs **the stall**, and the environment behind
  it is exempt. §2.10's rationale is that "warmth and craft build trust... the further the fall
  when the game turns", and that argument is not weakened by this task. A sunny farm at midday
  reads friendlier and more trustworthy than today's dark box, so the rationale gets *stronger*.
  Say that in the amendment so a later reader does not mistake this for a drift away from §2.10.

§3.3 also gains the environment as a layer behind the five existing regions.

## Files created or modified

- `SPEC.md` (modify: §2.10 scope, §3.1 environment palette group, §3.3 anatomy)
- `css/style.css` (modify: the scene, and the chrome that sits on it)
- `index.html` (modify: environment markup, if the scene needs elements the CSS cannot supply)
- `js/palette.js` (modify **only** if sprite-rendered scenery is used; see notes)
- `tests/e2e/outdoor-scene.spec.js` (new)
- `tests/e2e/stall-chrome.spec.js` (modify: the warm-tone guard's scope; see notes)
- `tests/e2e/stall-chrome.spec.js-snapshots/*` (regenerate, deliberately)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| **`the sky is behind the stall, not in it`** | Playwright | The environment layer's painted area is strictly outside every `[data-region]` box, or is behind them in paint order. The stall must still read as an object sitting in a place. |
| `the sky reads as sky` | Playwright | The topmost environment band's computed color is in the blue hue range and is neither near-black nor near-white. Fails today: `body` is `--fm-wood-dark`. |
| `a field horizon separates sky from ground` | Playwright | Sampling the environment top to bottom crosses from a blue band to a green band exactly once. Encodes "outskirts of a farm" as a measurable property rather than a mood. |
| **`the stall chrome is still warm`** | Playwright | Every `[data-region]` that paints a background is still outside the 200 to 300 cold-hue band. This is `chrome is warm-toned` from task 12, kept intact and now explicitly scoped to the stall. |
| **`the environment is exempt from the warm-tone rule, and only the environment`** | Playwright | Exactly the environment layer is exempt; the exemption cannot be widened to a region by accident. Names the exempt selector so the escape stays a single documented hole. |
| `no image assets and no network requests` | Playwright | Every request is same-origin and limited to app files, and no CSS declaration references an external `url()`. Re-confirms `SPEC.md` §11 after the scene lands. |
| `the scene does not crowd the cards` | Playwright | At 375, 768 and 1440px, all 36 cards are visible without scrolling the grid and the grid occupies no less of the viewport height than it does today. Scenery must not push the game off the screen. |
| **`sprites stay legible against the new backdrop`** | Playwright | Re-run the pairwise silhouette check at the 375px shipped card size. The threshold from tasks 04 to 10 still holds. |
| **`text still passes WCAG AA`** | Playwright | Scoreboard digits, button labels, price tags and the title still meet AA against whatever now sits behind them. Contrast already had to be repaired once, in `4154fdc`; this guards the repair. |
| `focus is still visible against the new backdrop` | Playwright | Every focusable element's focus indicator still clears 3:1 against its backdrop, including any control that now overlaps the sky. |
| `reduced motion stills the scenery` | Playwright | Any drifting cloud or ambient motion is stopped under `prefers-reduced-motion: reduce`. Note this is the opposite of the card flip, which §9 requires be shortened and never removed, because the flip hides the rig and clouds hide nothing. |
| `the scene survives a long session` | Playwright | Node and listener counts are unchanged after 50 attempts. Ambient animation must not accumulate anything. |

## Implementation notes

- **Pixel idiom throughout.** No photographic gradients, no soft blur, no drop shadows that
  break the 8-bit read. `SPEC.md` §2.9 and §3.2 are unchanged by this task.
- **No image assets, no external requests.** The awning at `css/style.css:101` already builds a
  scalloped edge from a CSS mask with no asset; that is the technique to reuse for clouds and
  the horizon line. `SPEC.md` §11 and the CSP in §11.1 both forbid the alternative.
- **Decide the warm-tone exemption deliberately and write down which way you went.** The guard
  at `tests/e2e/stall-chrome.spec.js:102` walks every `[data-region]` and fails any hue between
  200 and 300, so a blue sky breaks it if the sky is a region. Either keep the sky out of
  `[data-region]` entirely, or exempt exactly one named selector. **Do not widen the hue band.**
  That band is what carries §2.10, and widening it silently retires the guard.
- Build on what exists rather than replacing it: the five `data-region` containers, the `.bevel`
  primitive at `css/style.css:82`, and the `:root` custom properties. New environment colors are
  new properties in the same block, named for their role.
- The cards are the focal point and must stay that way. Scenery competes for attention with the
  one thing the player has to read carefully, so keep contrast and detail low behind the grid.
- Snapshot baselines for all three engines are invalidated. Regenerate them deliberately and say
  so in the changelog, the way tasks 12, 13 and 17 did.
- Ambient motion is optional. If you add it, it must be cheap, must stop under reduced motion,
  and must never run on the same frames as a card flip; the flip's timing is load-bearing
  (`SPEC.md` §2.3, §7.1) and a busy compositor is how that gets missed.
- This task changes no game behavior. If a gameplay test fails, the fix belongs in the task that
  owns that behavior, not here.

## Definition of done

- All twelve E2E tests green on chromium, firefox and webkit.
- Full suite green, including the a11y contrast and sprite-distinctness suites.
- Snapshot baselines regenerated for all three engines, with the reason recorded.
- `SPEC.md` §2.10, §3.1 and §3.3 amended **before** the CSS, per `AGENTS.md`.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
