# Task 20: silentReshuffle and the tally invariant

## Objective

Reshuffle unmatched card identities after every failed attempt, silently, while keeping every
fruit count even. **Seals the tally detection channel.**

## Depends on

15, 19

## Spec reference

`SPEC.md` §2.5, §2.12 (rationale), §7.3 (the algorithm), §10.3 (the tally invariant).

## Files created or modified

- `js/game.js` (modify: implement `silentReshuffle` and call it from the mismatch path)
- `tests/unit/reshuffle.test.js` (new)
- `tests/e2e/reshuffle-silence.spec.js` (new)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| `runs after a failed attempt` | Vitest | The mismatch path calls it once, after both cards are back to `'down'`. Fails: function does not exist. Never runs after a successful match. |
| `never touches locked cards` | Vitest | Cards in state `'locked'` keep their fruit and position through any number of reshuffles. Matched pairs are permanent. |
| `preserves the card count` | Vitest | Still exactly 36 cards, ids unchanged, only fruits reassigned. |
| **`every unmatched fruit count is even after a reshuffle`** | Vitest | Base case: reshuffle a clean board and assert every fruit count is even. **The tally invariant from `SPEC.md` §10.3.** |
| **`counts stay even after arbitrary reroll and reshuffle sequences`** | Vitest | Property test: run 200 randomized cycles of rigged reveal, reroll, and reshuffle, asserting even counts after every single cycle. **This is the test the whole task exists for.** The reroll in task 19 mutates one card's fruit and leaves counts odd; only regeneration repairs them. |
| **`regenerates rather than permutes`** | Vitest | Corrupt the board into an impossible state (five apples, seven bananas), reshuffle, and assert the counts come back even. A permutation of current values would faithfully preserve the corruption and fail here. **This is what distinguishes the correct implementation from the obvious wrong one.** |
| `outstanding pair count drives the multiset` | Vitest | With `matches` at 5, the unmatched multiset totals `2 * (18 - 5) = 26` cards. |
| `distributes across all six fruits` | Vitest | The regenerated multiset uses several fruits rather than collapsing onto one, so the board stays plausible. |
| `board always looks solvable` | Vitest | After any cycle, the unmatched cards could in principle be paired off completely. The direct statement of the illusion `SPEC.md` §2.12 is protecting. |
| `changes the arrangement` | Vitest | Positions actually differ after a reshuffle. A no-op would leave the player's mental map intact and defeat the point. |
| **`emits no sound`** | Playwright | Spy on the audio module across a full failed attempt and assert no cue fires during the reshuffle window, after the mismatch buzz has completed. |
| **`produces no visual change`** | Playwright | Screenshot immediately before and after the reshuffle and assert pixel-identical output. No animation, no transition, no reflow. `SPEC.md` §7.3 is emphatic: only hidden identities change. |
| `does not disturb the flip-back timing` | Playwright | Total time from mismatch to the next accepted click is unchanged from the honest phase. The reshuffle must not add a measurable pause. |

## Implementation notes

- The algorithm from `SPEC.md` §7.3, in order:
  1. Count outstanding pairs as `18 - matches`.
  2. **Regenerate** the multiset from that pair count, distributing across the six fruits so
     every count is even.
  3. Fisher-Yates shuffle it (task 15) and assign to the unmatched cards.
- Step 2 is the whole task. Permuting the current fruit values is the intuitive implementation
  and it is wrong: it preserves the odd counts that task 19's reroll introduces, and a player
  who flips around and tallies finds a provably unsolvable board. Two of the tests above exist
  specifically to fail against that implementation.
- Run it after the cards are visually face-down, never during. Reassigning identities while a
  card is readable would be visible.
- Do not reset `lastShown` during the reshuffle. Task 19's exclusion 2 depends on it, and
  clearing it would let a card redisplay the fruit it just showed.

## Definition of done

- All ten unit tests and three E2E tests green, especially the property test and the
  regenerate-not-permute test.
- Verified that a permutation-based implementation fails those two tests.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
