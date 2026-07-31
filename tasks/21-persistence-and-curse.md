# Task 21: Persistence and the compounding curse

## Objective

Persist `rigLevel` to `localStorage` and wire the Reset button so each press shortens the
honest phase. **Seals the persistence detection channel.**

## Depends on

16, 18

## Spec reference

`SPEC.md` §2.7, §2.8 (rationale), §8 (the persistence spec in full), §10.3.

## Files created or modified

- `js/game.js` (modify: load, save, reset)
- `index.html` (modify: wire the reset button from task 12)
- `tests/unit/persistence.test.js` (new)
- `tests/e2e/compounding-curse.spec.js` (new)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| `defaults to rigLevel 5 on a fresh browser` | Vitest | With empty storage, `rigLevel` is 5 and `muted` is false. Fails: no persistence layer. |
| `writes the documented shape` | Vitest | Storage key is `fm.state` holding `{ rigLevel, muted }` per `SPEC.md` §8. |
| `recovers from a corrupt value` | Vitest | With `fm.state` set to malformed JSON, the game loads defaults and overwrites rather than throwing. A crash on load would be a very loud tell. |
| `recovers from an out-of-range value` | Vitest | A stored `rigLevel` of `-3`, `999`, or a string clamps or resets to a valid value. |
| `reset decrements rigLevel by one` | Vitest | 5 becomes 4, 4 becomes 3, and so on. |
| **`reset floors at zero`** | Vitest | From 0, reset leaves it at 0 and never goes negative. A negative threshold would still satisfy `matches >= rigLevel`, but the floor keeps the state readable and the intent explicit. |
| `reset clears matches and reshuffles` | Vitest | `matches` returns to 0, all cards return to `'down'`, positions change. |
| `reset does not clobber muted` | Vitest | Toggling mute then resetting preserves the mute setting. Both keys share `fm.state` with task 14. |
| `board state is not persisted` | Vitest | Storage contains no card array. A reload starts a fresh board at the stored `rigLevel`, per `SPEC.md` §8. |
| `rigLevel 0 arms the rig immediately` | Vitest | With `rigLevel` 0 and `matches` 0, `rigged` is true before the first click. |
| **`six resets drive the curse to zero`** | Playwright | From a fresh browser, press Reset six times and assert stored `rigLevel` is 0 each step of the way: 4, 3, 2, 1, 0, 0. |
| **`at rigLevel 0 the very first attempt fails`** | Playwright | With the curse maxed, reveal a known true pair via the test hook, click it, and assert it does not match. The player never makes a single match again. |
| **`the curse survives a reload`** | Playwright | Drive `rigLevel` to 0, reload the page, and assert the first attempt still fails. **The persistence invariant from `SPEC.md` §10.3.** |
| `the curse survives a full browser restart` | Playwright | Persist across a new browser context with the same storage state. Confirms `localStorage` rather than session or in-memory storage. |
| **`no escape hatch exists`** | Playwright | Enumerate every interactive element on the page and assert none of them restores `rigLevel`. Press the documented non-controls (repeated signboard clicks, common cheat-code key sequences) and assert `rigLevel` is unchanged. **Encodes `SPEC.md` §2.8.** Written as a standing guard so nobody adds a kindly escape later. |
| `resetting does not announce itself` | Playwright | The UI shows no message, badge, or hint that the game has changed after a reset. The player must not learn that resetting made it worse. |

## Implementation notes

- Read storage once at init, write on every mutation. Keep a single read and a single write
  function; scattered `localStorage` calls make the shared `fm.state` key easy to clobber.
- Coordinate the object shape with task 14. Read-modify-write the whole object, never
  overwrite the key with a partial.
- The reset button markup already exists from task 12. This task only wires behavior.
- Wrap all storage access in try/catch. Private browsing modes can throw on write, and the
  game must degrade to in-memory rather than crash.
- Do not add a confirmation dialog, an "are you sure", or any copy suggesting the reset has a
  cost. The compounding is silent by design.

## Definition of done

- All ten unit tests and six E2E tests green, especially the reload survival and no-escape
  tests.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
