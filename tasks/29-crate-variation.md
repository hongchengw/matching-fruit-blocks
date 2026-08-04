# Task 29: Break up the wall of brown

## Objective

Give the face-down grid some variation so the stall looks stocked rather than tiled, without
handing the player a way to track a card through a reshuffle.

## Depends on

10, 13, 23

## Spec reference

`SPEC.md` §2.9, §3.2, §3.3, §3.4, §10.3.

## The problem this fixes

All 36 card backs are pixel-identical, which task 10 asserts deliberately. Against task 23's new
sky the grid now reads as one large brown slab, and it is the thing the player looks at most.

## The trap in this task, which is the reason it has a spec reference at all

**Variation must be a property of the position, never of the card.**

If a card's back varied with its identity, its id, or anything that travels with it, the player
could track a specific card straight through a silent reshuffle and watch its fruit change. That
is the visual channel from §10.3 reopened at its widest, and it would be reopened by a decorative
change, which is exactly the kind of regression `AGENTS.md` warns is a regression even when every
test still passes.

The variation must be bound to the **grid slot**. A card that moves does not carry its look with
it, because nothing moves: only hidden identities are ever reassigned, and the slot stays put.

Task 10's `no per-card variants` test exists precisely to hold this line. **It is not being
relaxed.** It asserts a property of the sprite registry, and the sprite registry still ships one
card back. This task varies the presentation of the slot around that sprite.

## Files created or modified

- `css/style.css` (modify: slot-level variation on the grid)
- `SPEC.md` (modify: §3.4, recording the slot-not-card rule)
- `tests/e2e/crate-variation.spec.js` (new)
- `tests/e2e/stall-chrome.spec.js-snapshots/*` (regenerate, deliberately)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| **`the back sprite is still one sprite`** | Playwright | Every card's back canvas renders pixel-identical RGBA. Task 10's guarantee, restated at the rendering level rather than the registry level. |
| **`variation is bound to the slot, not the card`** | Playwright | Record each slot's appearance, force a reshuffle, and assert the appearance of every slot is unchanged while identities have moved. **The test this task exists to satisfy.** |
| `the grid is not uniform` | Playwright | Sampling the face-down grid finds more than one distinct slot appearance. Fails today. |
| `variation is subtle` | Playwright | The difference between any two slots stays below a stated bound. Loud variation competes with the sprites and §3.6 already forbids the scenery doing that. |
| `a revealed card is unaffected` | Playwright | Slot variation applies to the back only. The fruit face must render identically in every slot or the sprite-distinctness suites stop meaning anything. |
| `locked cards still read as locked` | Playwright | The recessed treatment from §3.4 still separates matched cards from live ones at every slot. |
| `contrast still passes` | Playwright | Focus indicators still clear 3:1 against every slot variant. The focus ring has to work everywhere it can land. |

## Implementation notes

- CSS only, driven by the slot's position in the grid, for example with `:nth-child` bands. Do not
  add per-card markup, a data attribute carrying a variant, or anything the renderer sets from
  card state. If the variation is reachable from `js/game.js` it is reachable from the rig.
- Vary the crate slats, not the leaf: grain offset, a slightly different slat rhythm, a shade of
  wood. Two or three variants is enough. The goal is that the eye stops reading a tiled texture.
- No new sprite. `SPEC.md` §3.2's registry is untouched and task 10's single card back still ships.
- Snapshot baselines for all three engines are invalidated. Regenerate deliberately and say so.
- Cosmetic task, zero behavior change. If a gameplay test fails, something is wrong with the
  approach rather than with the test.

## Definition of done

- All seven tests green on chromium, firefox and webkit, `variation is bound to the slot` above all.
- Full suite green, including the sprite-distinctness and a11y contrast suites.
- Snapshot baselines regenerated with the reason recorded.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
