# Task 24: The honest board holds still

## Objective

Stop the silent reshuffle from running during the honest phase. Card identities may only move
once the rig has armed, so a player's memory is worth something for the first `rigLevel`
matches.

## Depends on

16, 20, 22

## Spec reference

`SPEC.md` §2.5, §2.12, §6.5, §7.2, §7.3, §10.3.

**This is a design change, not a bug fix, and the spec is amended first.** The current code is
correct against the current spec. `js/game.js:308` calls `silentReshuffle` unconditionally, and
that is exactly what §2.5 asks for ("after **every** failed attempt"), what §6.5 lists inside the
honest-phase sequence, and what §7.3 restates. All three say "every failed attempt" and all three
must change to say the rig must be armed.

QA found this by playing: the board shifted before a single match had been made. It was
reproducible and it was specified.

## Files created or modified

- `SPEC.md` (modify: §2.5, §6.5 step 5, §7.3)
- `js/game.js` (modify: the call site at line 308 only)
- `tests/e2e/honest-board-stability.spec.js` (new)
- `tests/e2e/reshuffle-silence.spec.js` (modify: fixtures, not assertions; see notes)
- `tests/unit/reshuffle.test.js` (modify: add the gate tests)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| **`the honest board holds still across a failed attempt`** | Playwright | With the rig unarmed, record every unmatched card's fruit, play a full mismatch, and assert the board is **identical** afterward. Fails today: every identity moves. This is the property QA asked for. |
| **`the honest board holds still for the whole honest phase`** | Playwright | Repeat across several failed attempts before the threshold, asserting stability after each one. A single-attempt check would pass an implementation that reshuffles every other time. |
| **`memory works while honest`** | Playwright | Reveal a card, let the attempt fail, then reveal that same card again and assert it shows the same fruit. States the property the way a player would experience it, not the way the code stores it. |
| **`the reshuffle resumes the moment the rig arms`** | Playwright | Play to the threshold, then fail an attempt and assert unmatched identities did move. The gate must not disable the reshuffle outright; the rigged phase still depends on it. |
| `the gate follows rigLevel, not the number 5` | Playwright | With `&fm-rig=2`, the board is stable for two matches and moves after. The condition is `rigged`, never a hardcoded threshold. |
| **`every unmatched fruit count stays even, honest and rigged`** | Vitest | Run long random sequences across the phase boundary and assert counts stay even throughout. **The tally invariant from `SPEC.md` §10.3, re-proven under the gate.** |
| `silentReshuffle itself is unchanged` | Vitest | The existing direct-call tests still pass untouched. Only the call site is gated; the function's contract does not move. |
| `an honest mismatch still takes 1000ms` | Playwright | Flip-back timing is identical before and after the threshold. Skipping work on the honest path must not make the honest path faster, which would be a new timing tell. |

## Implementation notes

- **The tally invariant is not at risk, and this is the first thing to understand.** §7.3's
  regeneration exists to repair the odd fruit counts that §7.2's reroll introduces. The reroll
  only ever runs when `rigged`. Gating the reshuffle on the same condition means every reroll is
  still followed by a reshuffle, so the counts are still repaired every time they are damaged.
  During the honest phase nothing damages them, because nothing rerolls.
- **Gate on `rigged`, and on nothing else.** Not on `matches`, not on a new flag. `rigged` is a
  derived getter for exactly the reason given at `js/game.js:270`: a stored flag drifts.
- **Do not make the honest path cheaper than the rigged one in any observable way.** The two
  phases are indistinguishable by ear and by stopwatch today and must stay so. The reshuffle
  happens inside the 1000ms window with the input lock held, so removing it should change no
  timing, but assert that rather than assume it.
- **`tests/e2e/reshuffle-silence.spec.js` will fail, and its fixtures are what change.** All
  three of its tests load `/?fm-test=1` at the default `rigLevel` with zero matches, so they
  currently exercise the reshuffle honestly. Re-point them at a rigged board with `&fm-rig=0`.
  Their assertions, that the reshuffle makes no sound, no visual change, and no timing
  difference, are unchanged and must not be touched. Record in the changelog that this was a
  fixture change and why.
- **An accepted trade, deliberately made: this opens a small new detection channel.** Today the
  reshuffle starts on attempt one, so its onset says nothing. Gated, it begins at the exact
  moment the rig arms, and a player with a good memory could in principle notice that their
  memory stopped working right when their matches stopped landing. That was weighed and accepted
  in favour of an honest phase that is genuinely honest. **Do not "seal" this by reverting the
  gate.** If it needs sealing later, it is sealed by changing when the rig arms, not by taking
  the player's memory away before it does.
- Nothing about `rerollFruit`, `buildEvenMultiset` or `silentReshuffle` changes. This is a
  one-condition change at a single call site plus the tests that pin it.

## Definition of done

- All six E2E tests and both Vitest additions green on chromium, firefox and webkit.
- `tests/e2e/reshuffle-silence.spec.js` green again on rigged fixtures, with assertions unchanged.
- The four sealed channels from `SPEC.md` §10.3 all still green, the tally one especially.
- `SPEC.md` §2.5, §6.5 and §7.3 amended **before** the code, per `AGENTS.md`.
- Changelog entry appended, recording that this was a specified behavior the user chose to
  change, not a defect in the implementation.
- RED and GREEN commits pushed to `origin/main`.
