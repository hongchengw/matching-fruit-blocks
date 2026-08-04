# Task 25: Reset stops compounding the curse

## Objective

Make Reset non-destructive. It reshuffles the board and clears `matches`, and it leaves
`rigLevel` alone. The honest phase is available again at the start of every round.

## Depends on

21, 22

## Spec reference

`SPEC.md` §1, §2.7, §2.8, §8, §10.3.

## Read this before starting

**This reverses a design pillar, and it is a deliberate decision by the project owner made after
playing the game.** It is not a cleanup and it is not a bug fix. Task 21 built the compounding
curse on purpose, `AGENTS.md` says in as many words that the rig is not a bug and must not be
softened, and this task softens exactly one part of it. That instruction stands for everything
else: the rig itself, the reroll, the silent reshuffle, the frozen counter and the absent win
screen are all untouched and must stay untouched.

What changes is the scope of the punishment. The game goes from **permanently** unwinnable to
unwinnable **per round**. A player who resets gets another honest phase.

Because a future reader will otherwise compare the code to §1 and file the code as the bug, the
spec must be amended to say this plainly before any code moves.

## Files created or modified

- `SPEC.md` (modify: §1 premise, delete §2.7, amend §2.8, rewrite §8, amend §10.3)
- `js/game.js` (modify: `reset`, and the state write it performs)
- `tests/unit/persistence.test.js` (modify: replace the decrement tests)
- `tests/e2e/compounding-curse.spec.js` (rename and rewrite; the name is now wrong)
- `tests/e2e/integration.spec.js` (modify: `a full curse cycle`)

## Spec changes in detail

| Section | Change |
|---|---|
| §1 | The premise becomes per-round rather than permanent. Say what the game still is: fair for `rigLevel` matches, then unwinnable until the player resets. |
| §2.7 | **Delete.** Its entire rationale is "punishes the instinct to start over", which is the behavior being removed. Do not leave a hollowed-out section. |
| §2.8 | Amend. Reset is now, in effect, the escape hatch §2.8 forbade. §2.8 keeps its force over everything else: still no hidden reset, no Konami code, no time decay, no UI hint that anything is being escaped. |
| §8 | Rewrite. `rigLevel` no longer decrements and there is no `rigLevel: 0` clause. It is written once and read back stable. |
| §10.3 | The persistence invariant becomes "`rigLevel` is stable at 5 and survives reload". Half of the old wording described the decrement. |

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| **`reset leaves rigLevel alone`** | Vitest | From 5, reset leaves 5. Ten resets still leave 5. Fails today: it decrements. |
| `reset still clears matches and deals a new board` | Vitest | `matches` returns to 0, every card returns to `'down'`, positions change. Unchanged from task 21 and must stay green. |
| `reset still does not clobber muted` | Vitest | Toggling mute then resetting preserves it. `fm.state` is shared with `js/audio.js`. |
| `board state is still not persisted` | Vitest | Storage holds no card array. |
| `a stored rigLevel is still clamped` | Vitest | A hand-edited `-3`, `999` or `"five"` still resolves to something valid. `sanitizeRigLevel` stays; it defends against tampering, which has not gone away. |
| **`the honest phase returns after a reset`** | Playwright | Play to the wall, press Reset, and assert the next attempt on a true pair **matches**. This is the whole point of the task and it fails today. |
| **`the wall still exists after a reset`** | Playwright | After resetting, play `rigLevel` matches again and assert attempt `rigLevel + 1` fails. Resetting must restore the honest phase without removing the rig. |
| **`rigLevel survives a reload`** | Playwright | Reload and assert `rigLevel` is still 5 and the game still arms after 5 matches. **The persistence channel from §10.3, in its new form.** |
| `rigLevel survives a browser restart` | Playwright | Same, across a new browser context with the same storage. |
| **`resetting still does not announce itself`** | Playwright | No message, badge, hint or copy about what Reset did. **This one matters more than it used to**, not less: the game must not start explaining itself just because it got kinder. |
| **`no escape from the rigged phase except Reset`** | Playwright | Replaces `no escape hatch exists`. Enumerate every interactive element, hammer the signboard, try the usual cheat sequences, and assert nothing but the Reset button restores an honest phase. §2.8 with one documented exception. |

## Implementation notes

- **Delete the decrement, do not clamp it to zero steps.** `Math.max(0, rigLevel - 1)` with the
  1 changed to a 0 is a way of leaving the mechanism in place for someone to switch back on by
  accident. If `rigLevel` is no longer written by reset, do not write it in reset.
- **`rigLevel` stays persisted and stays configurable.** It is still loaded from storage, still
  clamped, and still overridable by `&fm-rig=` behind the `?fm-test=1` gate, because the rigged
  phase still exists and its tests still have to reach it.
- `tests/e2e/compounding-curse.spec.js` is misnamed once there is no compounding curse. Rename it
  for what it now guards, and rewrite rather than delete: the persistence channel still needs a
  home, and so does the no-escape guard.
- Five tests assert behavior that is being removed, and each one's removal reason belongs in the
  changelog: `six resets drive the curse to zero`, `at rigLevel 0 the very first attempt fails`,
  `the curse survives a reload`, `the curse survives a browser restart` and `no escape hatch
  exists` in the e2e file; `decrements rigLevel by one`, `floors at zero` and `arms the rig
  immediately once rigLevel reaches 0` in `tests/unit/persistence.test.js`; and `a full curse
  cycle` in `tests/e2e/integration.spec.js`. **These are being deleted because the behavior they
  guarded was deliberately removed, which is the only acceptable reason to delete a passing
  test.** Say that explicitly, so the diff is not mistaken for a suite being quietened.
- Everything else about the rig is out of scope and must not drift: no win screen, no
  difficulty setting, no message when the wall is hit, no change to the reroll or the reshuffle,
  and the counter still freezes on its own without special-case code (§2.6).
- Task 24 gates the reshuffle on `rigged`, so after this task a reset also restores a stable
  board. The two tasks are independent and can land in either order, but whichever lands second
  should confirm that combination behaves.

## Definition of done

- All five Vitest tests and six E2E tests green on chromium, firefox and webkit.
- Full suite green, with every deleted test's deletion justified in the changelog.
- `SPEC.md` §1, §2.7, §2.8, §8 and §10.3 amended **before** the code, per `AGENTS.md`.
- `SECURITY.md`'s note about `&fm-rig=` re-checked, since it currently reasons about a curse
  that compounds.
- Changelog entry appended, stating plainly that this reverses part of task 21 at the owner's
  direction and what the game now is.
- RED and GREEN commits pushed to `origin/main`.
