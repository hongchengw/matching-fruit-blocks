# Task 27: Rot the board from the edges, not all at once

## Objective

Reshuffle only the cards the player has not looked at recently. Their fresh memories stay true
and their older ones quietly rot, so memory degrades like memory instead of switching off like a
light.

## Depends on

19, 20, 24

## Spec reference

`SPEC.md` §2.5, §2.12, §7.3, §10.3.

## The problem this fixes

Task 24 made the honest board hold perfectly still, which was right, and it created the tell that
task 24's own spec entry records as an accepted cost.

The board is now flawless for `rigLevel` matches and then starts moving on the very next failure.
A player with a good memory gets two signals arriving at the same instant: their recall stops
working, and their matches stop landing. Two coincident signals are far easier to correlate than
one, and the correlation points straight at "the game changed something."

Worse, the current reshuffle moves *everything*, including the pair the player revealed four
seconds ago. That is not what forgetting feels like. Forgetting is old things going first.

## The design

Each card carries the attempt number at which it was last revealed. On a rigged failure, only
cards whose last reveal is older than a threshold are eligible to be reshuffled. Recently seen
cards keep their identities.

Two things fall out of this, and both are the point:

- **The onset stops being an event.** Immediately after the rig arms, most of the board is cold,
  so the change is invisible. As the player keeps flipping, the warm set churns and the rot stays
  just behind them.
- **The player is always contradicted by their older memories and confirmed by their newer ones.**
  That is exactly the shape of ordinary memory failure, and it is much harder to distrust than a
  board that lies about everything equally.

## Files created or modified

- `SPEC.md` (modify: §2.5, §7.3)
- `js/game.js` (modify: `silentReshuffle`'s eligible set, and reveal bookkeeping)
- `tests/unit/cold-reshuffle.test.js` (new)
- `tests/e2e/memory-rot.spec.js` (new)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| **`a card just revealed keeps its fruit`** | Playwright | Reveal a card in a rigged attempt, fail, and assert that same card still shows the same fruit on the next reveal. Fails today: everything moves. |
| **`a card revealed long ago does not`** | Playwright | Reveal a card, play enough attempts elsewhere for it to go cold, and assert its identity has moved. |
| **`the warm set follows the player`** | Vitest | After a sequence of reveals, exactly the recently revealed cards are excluded from the eligible set. The rule is about recency, not position or id. |
| **`the threshold is one named constant`** | Vitest | Read the module source and assert the recency window is defined once. Scattered thresholds drift and this one is felt rather than seen. |
| **`the onset is not observable`** | Playwright | Compare the number of identities that move on the first rigged failure against a later one. The first must not be an outlier, which is the whole point of the task. |
| **`every unmatched fruit count stays even`** | Vitest | 500 randomized rigged cycles with a partial eligible set. **This is the invariant most at risk in this task**; see the notes. |
| **`the board still looks solvable`** | Vitest | After any sequence, the unmatched multiset can still be paired off completely. Even counts alone do not guarantee this once the reshuffle stops being free to move everything. |
| **`locked cards are still never touched`** | Vitest | Unchanged from task 20 and must stay true. |
| **`the reshuffle is still silent and invisible`** | Playwright | No cue, no visual change, no timing difference. Task 20's three guarantees are unchanged. |

## Implementation notes

- **The tally invariant is genuinely at risk here and that is the hard part of this task.**
  §7.3 works today because it regenerates the whole unmatched multiset from the outstanding pair
  count, which is what repairs the odd counts §7.2's reroll creates. Freeze a subset of cards and
  the regeneration no longer gets to choose those slots, so it must build a multiset for the cold
  slots that, *together with the frozen warm cards*, still leaves every fruit count even. That is
  the real work of this task. Write `every unmatched fruit count stays even` first and let it
  drive the implementation.
- A consequence worth planning for: if the warm set is large and awkwardly composed, there may be
  no assignment of the cold slots that keeps every count even. Decide deliberately what happens
  then. Preferring to shrink the warm set is better than breaking the invariant, and the
  invariant is not negotiable.
- `lastShown` already exists on each card for §7.2's exclusion rule. Recency is a different fact
  and needs its own field. Do not overload `lastShown`.
- Keep the recency window small enough that the player's working memory is genuinely respected
  and large enough that the rot is not visible at the boundary. Tune it by playing.
- This task must not touch the reveal or swap paths. It changes which cards the reshuffle may
  choose, and nothing else.

## Definition of done

- All nine tests green on chromium, firefox and webkit.
- The tally invariant re-proven under a partial eligible set, not assumed.
- Full suite green.
- `SPEC.md` §2.5 and §7.3 amended **before** the code, including removing task 24's note that the
  onset tell is accepted, since this task is what seals it.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
