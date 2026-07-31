# Task 15: Deck construction and shuffle

## Objective

Build the 36-card deck of 18 pairs and the Fisher-Yates shuffle that both setup and
`silentReshuffle` depend on.

## Depends on

01

## Spec reference

`SPEC.md` §2.1 (board composition), §5 (state model).

## Files created or modified

- `js/game.js` (new: deck construction and shuffle only)
- `tests/unit/deck.test.js` (new)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| `builds 36 cards` | Vitest | `buildDeck()` returns exactly 36 entries. Fails: module does not exist. |
| `cards match the state model shape` | Vitest | Every card has `id`, `fruit`, `state`, and `lastShown`, per `SPEC.md` §5. |
| `ids are 0 through 35 with no gaps` | Vitest | Sorted ids equal `[0..35]`. |
| `every card starts face down` | Vitest | Every `state` is `'down'` and every `lastShown` is `null`. |
| `uses exactly the six spec fruits` | Vitest | The distinct fruit set equals apple, banana, carrot, corn, tomato, pumpkin. No extras, none missing. |
| `each fruit appears exactly six times` | Vitest | Every fruit count is 6, giving 3 pairs each and 18 pairs total per `SPEC.md` §2.1. |
| **`every fruit count is even`** | Vitest | Redundant with the previous test at setup, and deliberately so. It is the same assertion task 20 makes after arbitrary reroll and reshuffle sequences, and stating it here establishes the invariant at its origin. |
| `shuffle permutes` | Vitest | Shuffling a known array changes the order across repeated runs. Guards against a no-op shuffle. |
| `shuffle preserves the multiset` | Vitest | Sorted output equals sorted input. A shuffle that drops or duplicates an element would silently break the pair count. |
| `shuffle is unbiased` | Vitest | Over many runs on a small array, every position receives every value at least once. Catches the common Fisher-Yates off-by-one that never moves the last element. |
| `shuffle does not mutate its input` | Vitest | The source array is unchanged after the call. `silentReshuffle` (task 20) regenerates rather than permutes in place and relies on this. |

## Implementation notes

- Keep deck construction and shuffle as pure functions. Task 16 introduces mutable game state;
  these two should stay independently testable and take no state.
- Shuffle should accept an optional random source so tests can inject a deterministic one.
  Default to `Math.random`.
- The fruit name strings are shared with `js/sprites.js` (tasks 04 through 09). Define them in
  one place and import, rather than duplicating the list. A typo across two lists would show a
  blank card only in the rigged phase, which is exactly where it would be hardest to notice.
- `js/game.js` starts here and grows through task 21. Keep the deck functions at the top and
  clearly separated from the state machine that arrives in task 16.

## Definition of done

- All eleven unit tests green.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
