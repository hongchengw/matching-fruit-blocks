# Task 28: Manufacture the near miss

## Objective

Bias the rigged reroll toward fruits the player has recently seen elsewhere, so that almost every
failure hands them a card whose twin they are certain they can find. They chase it. It is not
there.

## Depends on

19, 24

## Spec reference

`SPEC.md` §2.4, §2.11, §7.2, §10.3.

## The problem this fixes

§7.2 already prefers fruits still in play, but only as a tiebreak among candidates, so the fruit
the rig shows is essentially arbitrary. An arbitrary fruit produces an arbitrary reaction: the
player shrugs and flips somewhere else.

The strongest emotional beat this game can produce is not the failure itself. It is the moment
just after, when the player thinks **"wait, I know where that one is"** and goes to get it. That
moment is currently left to chance. This task engineers it.

The second-order effect is what makes this worth doing. A player who is chasing a specific
remembered card is a player generating their own explanation for every failure. They are not
thinking "this game is rigged." They are thinking "I was sure it was that one." That is precisely
the emotional payload §1 asks for, and it also keeps them playing far past the point where a
shrug would have stopped them.

## The design

When the rig picks a replacement fruit, prefer the fruit of a card the player revealed a small
number of attempts ago, at a different position on the board. All of §7.2's existing rules still
apply and still come first:

1. Never the first card's fruit. Hard, never dropped. This is what makes the attempt fail.
2. Never the card's own `lastShown`. Soft, dropped only if it would empty the pool.
3. **New:** among what remains, prefer a fruit the player has recently seen elsewhere.
4. Then the existing preference for fruits still in play.
5. Then anything left.

## Files created or modified

- `SPEC.md` (modify: §2.11 rationale, §7.2 step order)
- `js/game.js` (modify: `rerollFruit`'s preference order)
- `tests/unit/near-miss.test.js` (new)
- `tests/e2e/near-miss.spec.js` (new)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| **`prefers a recently seen fruit`** | Vitest | With a recorded reveal history, the reroll picks a fruit from it far more often than chance. Pin the random source. Fails today: the choice ignores history entirely. |
| **`never the first card's fruit, still`** | Vitest | 1000 rerolls with a history stuffed entirely with the first card's fruit. The hard exclusion wins every time. **This is the rule the whole rig rests on and this task must not be able to bend it.** |
| **`never the card's own lastShown, unless forced`** | Vitest | Unchanged from task 19. A card showing banana, then banana again, then refusing to match is a visible contradiction. |
| **`falls back cleanly with no history`** | Vitest | On the very first rigged attempt the history is empty and the reroll still returns a legal fruit. |
| **`the distribution is not degenerate`** | Vitest | Across many attempts the reroll still returns a spread of fruits. A rig that always showed the same one would be obvious within a minute. |
| **`the preference is a preference, not a rule`** | Vitest | Where honouring the history would violate rule 1 or empty the pool, it is dropped. Assert the order of precedence explicitly. |
| **`the near miss actually lands`** | Playwright | Play rigged attempts and assert that in most of them the revealed fruit is one the player saw within the last few attempts. The property stated the way the player experiences it. |
| **`chasing it always fails`** | Playwright | Follow the bait: reveal the card whose twin was just dangled, and assert the attempt still fails. The trap has to be a trap. |
| **`the tally invariant still holds`** | Vitest | Unmatched fruit counts stay even. The reroll still damages counts and the reshuffle still repairs them; this only changes which fruit gets picked. |

## Implementation notes

- **Rule 1 is not negotiable and this task must not weaken it.** Write
  `never the first card's fruit, still` first, and make it hostile: fill the history with nothing
  but that fruit and run it a thousand times. If the preference can ever override the exclusion,
  the game becomes winnable by accident and the rig stops being a rig.
- `rerollFruit` is pure and must stay pure (§7.2, task 19). The reveal history is an argument, not
  a global read and not a game-state import. That purity is what makes the function testable
  without a game and it has already paid for itself twice.
- Recency here is the same idea as task 27's, and if both land they should share one notion of
  "recently seen" rather than keeping two subtly different ones. Whichever lands second should
  unify them.
- Do not bias toward the fruit the player saw *this* attempt on the first card. That is rule 1's
  territory and it would produce the contradiction §2.11 exists to prevent.
- Tune the strength by playing. Too weak and nothing changes. Too strong and every single failure
  dangles bait, which becomes a pattern, and a pattern is a tell.

## Definition of done

- All nine tests green on chromium, firefox and webkit.
- The hard exclusion re-proven under adversarial history, not assumed.
- Full suite green, all four §10.3 invariants included.
- `SPEC.md` §7.2 amended **before** the code.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
