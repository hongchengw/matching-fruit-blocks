# Task 26: Seal the statistical channel with an asymptotic wall

## Objective

Stop the rigged phase from producing a perfect 0% match rate. Matches become progressively rarer
as the board empties and never quite stop, so the player is always almost finished and never
finished.

## Depends on

18, 19, 24, 25

## Spec reference

`SPEC.md` §1, §2.2, §2.6, §2.11, §7.2, §10.3.

## The problem this fixes

`SPEC.md` §10.3 seals four channels: visual, audio, tally, persistence. **There is a fifth and it
is currently wide open.**

After the wall the match rate is exactly zero, permanently, and it is zero by construction:
`rerollFruit` excludes the first card's fruit as a hard rule that is never dropped, so a rigged
attempt cannot match even by accident. A player who flips twenty pairs they are confident about
and misses all twenty has not experienced memory failure. Real memory failure is noisy and noise
produces occasional lucky hits. A flawless zero is a signature.

§1 requires that "the player must never obtain proof they were cheated... Certainty is a failure
of the design." A perfect zero hands them certainty by inference, without their ever needing to
catch a sprite changing. Every other channel in this codebase is sealed against a player who is
*watching*. This one is open to a player who is merely *counting*, which is easier.

## The design decision this task carries

**Recommended: an asymptotic wall.** Match probability decays as the number of outstanding pairs
falls, and the final pair never matches. The player crawls from 5 toward 17 of 18, watching the
board empty, and stalls forever two cards from the end.

This is better than the current design on both axes:

- **It seals the channel.** A nonzero, decaying match rate is exactly what genuine memory failure
  against a shifting board looks like. There is no longer a statistic that proves anything.
- **It is far more punishing.** A counter frozen at 5/18 says "this game is broken." A counter
  that crawls to 17/18 and stops, with two cards sitting on the board refusing each other, says
  "I am so close" for as long as the player can stand it. §2.6 already argues that dangling
  matches are the primary psychological instrument on screen. This points that instrument at the
  player far more precisely.

**This requires amending `SPEC.md` §2.6, which is load-bearing.** §2.6 currently freezes
`SCORE` and `MATCHES MADE` at `rigLevel`/18 forever, and says explicitly that the freeze needs no
special-case code because it falls out of `matches` never incrementing. Under this task `matches`
does increment, rarely, so the freeze becomes a slowdown and the argument in §2.6 no longer holds
as written.

**Get the owner's sign-off on the §2.6 change before writing any code.** It is the one part of
this task that trades away an existing designed behavior rather than adding to it.

## Files created or modified

- `SPEC.md` (modify: §2.6, §7.2, §10.3, plus a new §7.4 for the decay rule)
- `js/game.js` (modify: the rigged outcome decision and the reroll's hard exclusion)
- `tests/unit/asymptotic-wall.test.js` (new)
- `tests/e2e/statistical-channel.spec.js` (new)
- `tests/e2e/scoreboard.spec.js` (modify: the freeze tests; see notes)
- `tests/e2e/integration.spec.js` (modify: `the honest phase, then the wall`)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| **`the last pair never matches`** | Vitest | With two unmatched cards left, no sequence of attempts ever matches them. Run 500 attempts. This is the floor that keeps the game unwinnable and it is absolute. |
| **`the board never empties`** | Vitest | Across 2000 randomized rigged attempts the outstanding pair count never reaches zero. |
| **`the match rate is never zero over a long run`** | Vitest | Over 200 rigged attempts on a full board, at least one match lands. Fails today: the rate is exactly zero by construction. |
| **`the match rate decays as the board empties`** | Vitest | Measured rate with 13 pairs outstanding is materially higher than with 3. Pin the random source so this is deterministic. |
| **`the rate is plausible, not generous`** | Vitest | With 13 pairs outstanding the rate stays well below an honest player's. The player must feel unlucky, never helped. |
| **`no run of failures is long enough to be proof`** | Vitest | Over 1000 attempts the longest consecutive failure streak stays under a stated bound. The bound is the number this task exists to control, so state it in the spec and assert it here. |
| **`a rigged match is indistinguishable from an honest one`** | Playwright | When the rig does grant a match, the cue, the timing, and the lock behaviour are identical to an honest match. A "mercy" match that felt different would be a worse tell than the one being fixed. |
| **`the counter crawls and then stops`** | Playwright | Play deep into the rigged phase and assert `MATCHES MADE` advances past `rigLevel` but never reaches 18. |
| **`the tally invariant still holds`** | Vitest | Unmatched fruit counts stay even across the decay, including when a rigged match locks a pair. Locking two cards changes the outstanding count, and the reshuffle's multiset must follow it. |
| **`the visual invariant still holds`** | Playwright | No readable frame shows anything but the committed sprite, on both granted and denied attempts. §10.3 is not weakened by this task. |

## Implementation notes

- **The floor is absolute and comes first.** Write `the last pair never matches` before anything
  else. Everything else in this task is a probability; that one is a guarantee, and it is what
  keeps §1 true.
- The decay belongs in one named pure function of the outstanding pair count, testable without a
  game. Do not scatter probability into the flip handler.
- **Do not let the granted match be special.** It must go through `resolveMatch` on the same path
  an honest match takes, with the same cue and the same timing. `SPEC.md` §4.3 forbids any branch
  on rig state reaching the audio module and that does not change here.
- Reconsider §2.11's hard exclusion carefully. Granting a match means the reroll must sometimes
  be allowed to return the first card's fruit, which is precisely the rule §2.11 calls the thing
  "that makes matching impossible." The exclusion is not being deleted; it is becoming
  conditional on the decay. Say so in the spec, because a reader will otherwise find the two
  statements in conflict.
- Task 17's `never advances past the rig threshold` and its 25-attempt freeze test both assert
  the old behavior and will fail. They are rewritten, not deleted: the property becomes "advances
  but never completes." Record the reason in the changelog.
- Tune the numbers against real play, not intuition. Sit and play it. The target feeling is "I am
  terrible at this and I am nearly there", not "this is broken."

## Definition of done

- All ten tests green on chromium, firefox and webkit.
- Full suite green, including all four existing §10.3 invariants.
- `SPEC.md` amended **before** the code, with the owner's explicit sign-off on the §2.6 change.
- Changelog entry recording what the freeze became and why.
- RED and GREEN commits pushed to `origin/main`.
