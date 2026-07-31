# Task 14: Audio engine and mute

## Objective

Build the three 8-bit cues on WebAudio, unlock the context on first gesture, and wire the mute
toggle. **Seals the audio detection channel.**

## Depends on

01

## Spec reference

`SPEC.md` §4 in full. §4.3 (the parity requirement) is the reason this task exists as its own
unit.

## Files created or modified

- `js/audio.js` (new)
- `tests/unit/audio.test.js` (new)

## Tests to write first

Mock `AudioContext` and inspect the constructed node graph. Do not assert on real sound.

| Test | Runner | Assertion |
|---|---|---|
| `exports the three cues and a mute control` | Vitest | `beepFlip`, `beepMatch`, `beepMismatch`, and the mute API are all defined. Fails: module does not exist. |
| **`no AudioContext before the first gesture`** | Vitest | After module import, zero `AudioContext` instances have been constructed. Browsers block context creation outside a gesture, so a module-load context would leave the game permanently silent. |
| `creates the context on first gesture` | Vitest | Exactly one context after the first cue call, and still exactly one after many more. The context is created once and reused. |
| `beepFlip is a short square click` | Vitest | One oscillator, `type: 'square'`, frequency near 440Hz, duration near 40ms, low gain. |
| `beepMatch is a rising two-note arpeggio` | Vitest | Two scheduled tones, the second at a strictly higher frequency than the first, each near 70ms. The rise is what makes it read as success. |
| `beepMismatch is a low buzz` | Vitest | One square oscillator near 180Hz, near 160ms, with a decay envelope. |
| **`rigged and honest mismatch produce identical node graphs`** | Vitest | Call `beepMismatch()` with the game in the honest phase and again with it rigged. Capture the full constructed graph both times (node types, frequencies, gain values, scheduled times normalized to call start) and assert deep equality. **This is the audio invariant from `SPEC.md` §10.3.** |
| **`no cue function branches on rig state`** | Vitest | The audio module exposes no parameter, option, or import through which rig state could reach it. Call each cue with the game rigged and honest and assert byte-identical graphs for all three. Structural guard: it should be impossible to make the sounds differ, not merely true that they currently do not. |
| `mute silences all three cues` | Vitest | With mute on, no cue constructs any oscillator. Not merely gain zero, since a zero-gain node still costs a graph and would show up in the parity comparison asymmetrically. |
| `mute persists to storage` | Vitest | Toggling mute writes `muted` into the `fm.state` key per `SPEC.md` §8. |
| `mute state is read on init` | Vitest | With `fm.state` preloaded as muted, cues are silent from the first call with no toggle needed. |

## Implementation notes

- The parity requirement is a design constraint on the module's shape, not just its behavior.
  **`js/audio.js` must not import game state, receive it as an argument, or read it from a
  global.** If rig state cannot reach the audio module, the sounds cannot diverge. Build it
  that way and the parity tests become structurally guaranteed rather than incidentally true.
- One shared lazily-created context. Create it inside the first cue call, not at module scope.
- Cues take no arguments. A cue with parameters is a cue that can be made to vary.
- Mute shares the `fm.state` localStorage key with task 21's `rigLevel`. Read and write the
  whole object; do not clobber sibling keys. Coordinate the shape with `SPEC.md` §8.
- Envelopes via `gain.gain.setValueAtTime` plus a ramp. Keep them short; these are UI clicks,
  not music.

## Definition of done

- All eleven unit tests green, especially the two parity tests.
- No path exists by which rig state can reach `js/audio.js`.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
