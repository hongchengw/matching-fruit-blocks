# Task 12: Stall scene chrome

## Objective

Dress the five regions from task 11 into an actual farmer's market stall: awning, signboard,
crate slats, price tags, wooden base.

## Depends on

03, 11

## Spec reference

`SPEC.md` §2.10 (why the chrome matters), §3.3 (stall anatomy).

## Files created or modified

- `index.html` (modify: decorative elements)
- `css/style.css` (modify: stall styling)
- `js/sprites.js` (modify: decorative sprites for the price tag and signboard bolts)
- `tests/e2e/stall-chrome.spec.js` (new)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| `awning renders repeating stripes` | Playwright | The awning element has a non-`none` computed background and a measured height above a documented minimum. Fails against task 11's unstyled div. |
| `awning spans the full stall width` | Playwright | Awning bounding box width equals the stall container width. |
| `signboard contains the title` | Playwright | Title text is present and visible inside the signboard region. |
| `signboard contains the mute toggle` | Playwright | A mute control exists inside the signboard and is visible. Task 14 wires its behavior; this only pins its location per `SPEC.md` §4.4. |
| `grid area has a crate-slat background` | Playwright | The grid area's computed background differs from the page background and shows horizontal banding when probed at two vertical offsets. |
| `price tags hang from the base` | Playwright | At least two price tag elements exist, and each one's top edge sits at or below the base region's top edge. |
| `reset button is in the base` | Playwright | A reset control exists inside the base region, is visible, and carries the bevel class from task 11. Task 21 wires its behavior. |
| `regions stack in the spec order` | Playwright | Measured vertical positions confirm awning above signboard above scoreboard above grid above base. Catches a flex or grid ordering regression. |
| `chrome is warm-toned` | Playwright | Sampled computed background colors across the stall regions all fall in the earth-tone hue and saturation range documented in `SPEC.md` §3.1. Encodes §2.10: the stall must read handmade and trustworthy, because a cold arcade look would telegraph malfunction. |
| `visual snapshot baseline` | Playwright | Full-page screenshot committed as the baseline. Later tasks that alter chrome must update it deliberately. |

## Implementation notes

- Decorative sprites go through `drawSprite` from task 03 so the chrome and the cards share
  one rendering path and one palette.
- Awning stripes are pure CSS (`repeating-linear-gradient` plus a scalloped bottom edge), not
  an image. No external assets.
- The scoreboard region gets its wood-grain frame and dark recessed inset here, but its digits
  and content belong to task 17. Style the container, leave the contents alone.
- Still no game behavior. The mute toggle and reset button are inert markup at this point;
  tasks 14 and 21 own them.
- Commit the snapshot baseline from a documented viewport size so it is reproducible.

## Definition of done

- All ten E2E tests green, snapshot baseline committed.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
