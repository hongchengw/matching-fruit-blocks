# Task 17: Scoreboard render and freeze

## Objective

Render `SCORE` and `MATCHES MADE: n/18` in the recessed LCD panel, and confirm the freeze
falls out of the rig rather than being coded.

## Depends on

12, 16

## Spec reference

`SPEC.md` §2.6 (why it freezes and why that needs no special case), §3.3 item 3.

## Files created or modified

- `index.html` (modify: scoreboard contents)
- `css/style.css` (modify: LCD digit styling)
- `js/game.js` (modify: scoreboard render)
- `tests/unit/scoreboard.test.js` (new)
- `tests/e2e/scoreboard.spec.js` (new)

## Tests to write first

| Test | Runner | Assertion |
|---|---|---|
| `renders score from state` | Vitest | The rendered score equals `state.matches`. Fails: no render function. |
| `renders matches made out of 18` | Vitest | Output reads `MATCHES MADE: 0/18` at start. The denominator is the constant 18 from `SPEC.md` §2.1 and never changes. |
| `updates on every match` | Vitest | After incrementing `matches`, a re-render shows the new value. |
| `denominator never changes` | Vitest | Across a full honest playthrough the denominator stays 18 at every step. |
| **`the freeze requires no dedicated code path`** | Vitest | The scoreboard render function reads only `state.matches` and the constant 18. It receives no rig state, has no branch on `rigged`, and has no frozen-value cache. **Encodes `SPEC.md` §2.6: "the freeze is a natural consequence of `matches` never incrementing again. Do not add logic to force it."** A future contributor who adds a freeze branch fails this test. |
| `digits are visible in the panel` | Playwright | Score and matches text are rendered inside the scoreboard region from task 12 and are visible. |
| `LCD styling is light on dark` | Playwright | Computed digit color is materially lighter than the panel background, per `SPEC.md` §3.3. |
| `shows 5/18 once the rig arms` | Playwright | Play 5 honest matches at the default `rigLevel` and assert the display reads `5/18`. |
| **`never advances past the rig threshold`** | Playwright | Continue for 20 further attempts after the rig arms and assert the display still reads exactly `5/18` at every check, with 13 matches visibly outstanding. The user-facing form of the frozen-counter decision. |

## Implementation notes

- The render is a pure function of `matches`. That is the entire mechanism. Keep it that way
  and the freeze is free.
- Digits use the LCD treatment from `SPEC.md` §3.3: dark recessed inset, light digits. Reuse
  the bevel primitive from task 11 in its recessed form.
- Fixed-width digit slots so the readout does not shift as numbers change. Layout jitter in a
  frozen counter draws attention to it.
- Do not add a win state when `matches` reaches 18. It is unreachable at any `rigLevel` above
  0, and `SPEC.md` §11 lists a win screen as a non-goal.

## Definition of done

- All five unit tests and four E2E tests green, especially the no-dedicated-code-path test.
- Full suite still green.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
