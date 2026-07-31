# Task 19: rerollFruit selection rules

## Objective

Replace task 18's stub with the real selection algorithm: the rule that makes matching
impossible while leaving no contradiction to catch.

## Depends on

15, 18

## Spec reference

`SPEC.md` §2.11 (rationale), §7.2 (the algorithm in full).

## Files created or modified

- `js/game.js` (modify: implement `rerollFruit`)
- `tests/unit/reroll.test.js` (new)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| `returns one of the six fruits` | Vitest | Output is always a valid fruit name. Fails: function is still the stub. |
| **`never returns the first card's fruit`** | Vitest | Over many runs against every possible first-card fruit, the result is never equal to it. **Exclusion 1, hard. This single rule is what makes the game unwinnable.** |
| **`never returns the card's lastShown fruit`** | Vitest | When `card.lastShown` is set and candidates remain, the result never equals it. Exclusion 2, soft. Without it a card can redisplay the fruit it just showed while still refusing to match, which is a visible self-contradiction. |
| `prefers fruits still in play` | Vitest | Given a board where two fruits have zero unmatched cards remaining, results overwhelmingly favor fruits with a non-zero count. Prevents the board from displaying produce that should not be there. |
| **`falls back by dropping exclusion 2, never exclusion 1`** | Vitest | Construct a state where the exclusions leave no candidate. Assert the result may equal `lastShown` but is still never `firstCard.fruit`. `SPEC.md` §7.2: exclusion 1 is never dropped. |
| `fallback path is actually reached` | Vitest | The constructed no-candidate state exercises the fallback branch, verified by coverage or an injected spy. A fallback that never runs is untested code sitting in the rig's hot path. |
| **`distribution is not degenerate`** | Vitest | Over many calls with a fixed first card, at least three distinct fruits are returned and no single fruit exceeds a documented share. A reroll that always returns banana would be trivially noticeable after a handful of attempts. |
| `commits the result to the card` | Vitest | After a rigged reveal, `card.fruit` equals the rerolled value, not the original. Task 20's reshuffle depends on this mutation actually landing. |
| `updates lastShown after the reveal` | Vitest | Once the rerolled fruit is displayed, `card.lastShown` equals it, so the next reroll on that card excludes it. |
| `accepts an injectable random source` | Vitest | A deterministic source produces deterministic output, so the tests above are stable rather than flaky. |
| `never returns a value outside the palette of registered sprites` | Vitest | Every possible output has a corresponding entry in `SPRITES`. A reroll to an unregistered name would throw in `drawSprite` (task 03) mid-flip and blank the card at the worst possible moment. |

## Implementation notes

- Order of operations: build the candidate set, apply exclusion 1, apply exclusion 2, apply
  the in-play preference, then pick. If the set empties, back off exclusion 2 and retry. Never
  back off exclusion 1.
- Keep it a pure function of `(card, firstCard, unmatchedCounts, random)`. It is the most
  consequential function in the codebase and it should be trivially testable in isolation.
- The in-play preference is a preference, not a filter. If it empties the candidate set,
  ignore it rather than falling through to exclusion 1.
- Do not consult `matches`, `rigLevel`, or `rigged` inside this function. It is only ever
  called when rigged; task 18 owns that decision.

## Definition of done

- All eleven unit tests green, especially the two exclusion rules and the fallback ordering.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
