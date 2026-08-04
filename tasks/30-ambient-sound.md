# Task 30: Ambient sound for the stall

## Objective

A quiet outdoor bed under the game: wind, the odd bird. Synthesized, muteable, and structurally
incapable of reacting to anything that happens in the game.

## Depends on

14, 23

## Spec reference

`SPEC.md` §4.1, §4.2, §4.3, §4.4, §10.3, §11.

## Why

Task 23 put the stall in a field and the field is silent. §2.10 is relying on warmth and craft to
build the trust the game later spends, and a silent scene reads as staged rather than inhabited.

## The trap in this task

`js/audio.js` is the most tightly constrained file in the repository, and for a reason that has
nothing to do with sound quality. §4.3 requires that a rigged mismatch be acoustically identical
to an honest one, and the module achieves that **structurally**: it imports no game state, every
cue takes zero arguments, and the only branch in the file is on mute. A source-level test reads
the file and fails if any game-state token appears in it.

Ambience is the first thing anyone would be tempted to make reactive. Tension that rises as the
player fails. A sting when the rig arms. **All of it is forbidden**, and not merely by taste: a
bed that changed with rig state would be the audio channel reopened, and reopened somewhere the
parity test is not looking, because the parity test compares cues rather than beds.

The safe shape is a bed that is a pure function of the clock and nothing else.

## Files created or modified

- `js/ambience.js` (new; see notes on why this is not `js/audio.js`)
- `js/game.js` (modify: start the bed on the first gesture, honour mute)
- `index.html` (modify: script wiring if needed)
- `tests/unit/ambience.test.js` (new)
- `tests/e2e/ambience.spec.js` (new)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| **`imports no game state`** | Vitest | Read `js/ambience.js` as source and assert no game-state token appears: `rig`, `match`, `card`, `fruit`, `reshuffle`, `game`. The same structural guard task 14 put on `js/audio.js`, for the same reason. |
| **`takes no arguments`** | Vitest | Every exported function has arity zero except the mute setter. Nothing about the game can be passed in. |
| **`branches only on mute`** | Vitest | Source-level: the only conditional in the module is the mute check. |
| **`is silent when muted`** | Vitest | With mute set, no oscillator and no node is constructed. |
| **`shares the mute setting`** | Playwright | The existing mute toggle silences the bed and the cues together, and the setting survives a reload. One control, one key, both already defined in §4.4. |
| **`creates no context before a gesture`** | Vitest | §4.2. Autoplay policy blocks it and a console warning on load is its own small tell. |
| **`does not mask the cues`** | Playwright | With the bed running, the three cues are still constructed with identical parameters. **§4.3's parity is measured with the ambience playing**, which is the condition that actually ships. |
| **`is identical either side of the wall`** | Playwright | Record the bed's node graph before and after the rig arms and assert no difference. The channel this task could reopen, closed by assertion. |
| **`leaks no nodes over a long session`** | Playwright | Node count is stable after 50 attempts. A bed that accumulates oscillators would eventually distort the cue timing, and timing is a channel too. |
| **`no audio assets are fetched`** | Playwright | Every request stays same-origin app files. §11, and the policy in §11.1 would refuse it anyway. |

## Implementation notes

- **A separate module, deliberately.** `js/audio.js` carries a source-level guard that no
  game-state token appears in it, and it is one of the cleanest safety properties in the codebase.
  Adding a hundred lines of ambience to that file makes the guard harder to trust and the file
  harder to read. A sibling module with the same constraints, and its own copy of the guard, keeps
  both small enough to verify by eye.
- Wind is filtered noise; a bird is two or three short sine blips with a gap. Keep the whole thing
  well under the cues in level. If the player notices it, it is too loud.
- **Never react to anything.** No tension curve, no sting, no stinger when the rig arms, no change
  in density as the board empties. The bed is a function of the clock. This is the single
  constraint the task exists to protect.
- Mute is one setting and one key. Do not add a second toggle; §4.4 already specifies one control,
  and a separate ambience control would tell the player the ambience is a separate thing.
- Reduced motion says nothing about audio and must not be used as a proxy for it. If a
  no-ambience preference is ever wanted it is its own decision, not an inference from a motion
  setting.

## Definition of done

- All ten tests green on chromium, firefox and webkit, with the WebKit no-WebAudio skip handled
  the way `reshuffle-silence.spec.js` already handles it.
- §4.3's cue parity re-proven **with the bed playing**.
- Full suite green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
