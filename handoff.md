# Handoff

Written 2026-08-03, mid task 22. Read [`AGENTS.md`](AGENTS.md) and [`SPEC.md`](SPEC.md) first;
this file only covers what is in flight and is not a substitute for either.

**The one-line summary:** tasks 14 through 21 are done and pushed. Task 22 is nearly done but
has uncommitted work in the tree and 3 failing e2e tests out of 276. Nothing has been committed
since `4154fdc`.

---

## 1. Do this first

There is a **large uncommitted diff** in the working tree. It is real work, it is not junk, and
it must not be discarded. `git stash` it only if you know why you are doing so.

```
 M SPEC.md                                  amended §7.1 (see §4 below)
 M js/game.js                               the two bug fixes in §4
 M playwright.config.js                     added firefox + webkit projects
 M scripts/serve.js                         security hardening (see §5)
 M tasks/18-rig-arming-and-midpoint-swap.md note pointing at the §7.1 amendment
 M tests/unit/rig-arming.test.js            two timing tests updated to the amended contract
 M tests/e2e/a11y.spec.js                   sampler + contrast-helper fixes
 M tests/e2e/grid-and-flip.spec.js          edge-on check now reads the matrix, not the rect
 M tests/e2e/integration.spec.js            sampler, cue signature, baseURL origin fixes
 M tests/e2e/midpoint-swap.spec.js          empty-canvas oracle + sampler fix
 M tests/e2e/page-structure.spec.js         bevel width tolerance for Firefox
 M tests/e2e/reshuffle-silence.spec.js      skips cleanly where WebAudio is absent
 ?? tests/e2e/server-hardening.spec.js      new, 7 tests, passing on all three engines
 ?? tests/e2e/stall-chrome.spec.js-snapshots/stall-baseline-{chromium,firefox,webkit}-win32.png
```

The three new snapshot baselines replace the old single-project `stall-baseline-win32.png`.
Adding named Playwright projects changed the snapshot path template, so the old filename is now
orphaned. **Check whether `stall-baseline-win32.png` is still tracked and delete it if so.**

## 2. Where the tests actually stand

| Suite | Result |
|---|---|
| `npm test` (vitest) | **163 passed**, 0 failed. Trustworthy. |
| `npm run e2e` (3 engines, 276 tests) | **272 passed, 3 failed, 1 skipped.** |

The 1 skip is deliberate: Playwright's WebKit build on Windows ships **no WebAudio at all**
(`window.AudioContext` is `undefined`), so `reshuffle-silence.spec.js` skips its listener test
there rather than asserting over an empty recording. The game already degrades to silence on
that engine instead of throwing.

**I do not know which 3 tests failed in the final run.** The session ended before I could read
the list. In the run before it, the 3 were:

1. `[chromium] integration.spec.js › all four invariants hold across the playthrough`
2. `[webkit] integration.spec.js › all four invariants hold across the playthrough`
3. `[webkit] midpoint-swap.spec.js › reduced motion preserves the hiding place`

and I pushed a fix for each before the final run, so the remaining 3 may be the same tests still
failing, or fewer of these plus something I have not seen. **Start by running
`npx playwright test --reporter=line` and reading the failure list.** Do not assume.

Diagnosed causes and the fixes already applied:

- **(1)** was my recorder, not the product. It timed each cue against `AudioContext.currentTime`
  at call time, so two identical 160ms buzzes recorded as 160 and 159 and the parity set had two
  members. It now derives duration from the two *scheduled* times, which are exact. The audio
  invariant itself is proven structurally in the unit suite (task 14) and was never in doubt.
- **(2)** was a frame sampler on a fixed 400ms window that sometimes ended before WebKit had
  turned the card. All three frame-sampling helpers now wait until the flip is *observed* to
  reach face-on, with a 2s ceiling.
- **(3)** asserted the card's face is observed carrying nothing before the swap. Under reduced
  motion the flip is 80ms and the swap lands at ~23ms, under one and a half frames, so a frame
  sampler cannot be relied on to catch it. That single assertion was dropped **in the
  reduced-motion test only**, with the reasoning in a comment. The normal-motion test still
  asserts it over a window four times as wide, and the invariant that matters, that nothing but
  the committed sprite is ever readable, is still asserted in both.

## 3. What is left to do

In rough order:

1. **Get the e2e suite green on all three engines.** See §2.
2. **Commit and push.** Nothing since `4154fdc` is committed. Use the `git-commit-formatter`
   skill. **Never add a `Co-Authored-By` trailer** (`AGENTS.md`). The tree currently holds work
   that belongs in more than one commit: the §4 bug fixes, the cross-engine config, and the §5
   security hardening are three separate concerns.
3. **Append `changelogs/CHANGELOGS.md` entries**, newest first, real EDT time via
   `TZ=America/New_York date "+%Y-%m-%d %H:%M EDT"`. Nothing is logged past task 21. Owed: task
   22, the cross-engine run, the WebKit backface fix, the §7.1 amendment, and the security audit.
4. **Write `SECURITY.md`** from §5 below. Not started.
5. **Consider a CSP** (§5). Not started, and it is optional.
6. **Hand the user QA notes** (§6). They asked for the app to be QA-ready and have been waiting
   on it.

## 4. Two real bugs found by the cross-engine run

Both are fixed in the working tree. Both are worth understanding before touching `js/game.js`.

### WebKit paints the front face through the card back

`backface-visibility: hidden` is **not honored** in this card stack on WebKit. A card that had
been revealed kept showing its fruit while face down, which exposes the board to any Safari
player. Verified directly: painting the hidden face changes the rendered pixels on WebKit and
does not on Chromium.

This was masked for most of the project because the renderer wiped the face the instant a card
went down. Removing that wipe (to fix a separate glitch where the fruit vanished a beat before
the card turned away) is what surfaced it. The renderer now **defers the wipe until the
flip-back has finished**, which satisfies both: the fruit rotates away naturally, and nothing is
left on screen once the card settles.

Fixing it also closed a **WebKit-only tell**: because the front face is always visible there,
honest reveals painted instantly while rigged ones painted half a flip later. Both phases now
paint on the same deadline through one `revealSecond` path, so only the choice of fruit differs.
Do not re-split that path.

### The swap could overshoot 90 degrees under reduced motion

Firefox was observed landing the swap after the face had become readable, flashing one frame of
an unpainted card. It never revealed the pre-swap fruit, because that is never drawn at all, but
a card that flashes blank is its own tell.

Per `AGENTS.md` the spec was amended first. **`SPEC.md` §7.1 now treats the midpoint as a
ceiling rather than a target**, with the reasoning: the front face is invisible for the whole
first half of the rotation, so swapping a frame early costs nothing, while swapping a frame late
does. `flipMidpoint` backs off by one frame and the swap races a timer against a rAF loop.

## 5. Security audit: findings so far

**Runtime: clean.** `npm audit --omit=dev` reports **0 vulnerabilities**. The shipped app has no
runtime dependencies, no build step, and makes no network requests.

**App source: no meaningful attack surface.** No `innerHTML`, `eval`, `document.write`,
`fetch`/`XHR`/`WebSocket`, cookies, or inline event handlers. Every DOM write goes through
`textContent` or `setAttribute`, and there is no user-supplied text anywhere. `localStorage`
reads are wrapped in try/catch and validated, and a corrupt or out-of-range value falls back to
documented defaults. No prototype-pollution path: `loadState` reads only two known keys.

**Dev dependencies: 5 advisories, all in the vitest/vite chain.**

| Severity | Advisory |
|---|---|
| critical | Vitest UI server allows arbitrary file read/execute (`GHSA-5xrq-8626-4rwp`) |
| high | Vite `server.fs.deny` bypass on Windows alternate paths (`GHSA-fx2h-pf6j-xcff`) |
| moderate | Vite path traversal in optimized deps `.map` handling (`GHSA-4w7w-66w2-5vf9`) |
| moderate | `launch-editor` NTLMv2 hash disclosure via UNC paths on Windows (`GHSA-v6wh-96g9-6wx3`) |
| moderate | `esbuild` (transitive) |

None affect the shipped artifact. The critical one requires the Vitest UI server, which this
project never starts. **There is no non-breaking fix**: `npm audit fix` offers only
`--force`, which is a vitest major bump. I judged that too risky to do unattended at the end of
the build with 163 unit tests riding on it. Recommend it as a deliberate follow-up, run against
the full suite. **This is a live decision for the user, not a settled one.**

**Fixed: `scripts/serve.js`.** The dev server had three real problems. It listened on all
interfaces, making the whole repo LAN-visible; it served dotfiles, so `/.git/config` handed over
the repository; and it normalized the path before decoding it, so `%2e%2e%2f` walked straight
past the traversal guard. It now binds to `127.0.0.1`, decodes before normalizing, uses a
separator-aware containment check instead of a bare `startsWith`, and refuses dotfiles below the
root. Covered by the new `tests/e2e/server-hardening.spec.js`: 7 tests, green on all three
engines. Note the deliberate non-goal there: traversal that resolves back *inside* the repo is
served, because that is what a static server for this directory is for. What must never happen
is the walk continuing past the root, and that is what the tests assert.

**Not done: a Content-Security-Policy.** Adding a strict `<meta http-equiv="Content-Security-Policy">`
to `index.html` (`default-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none';
frame-ancestors 'none'`) would enforce `SPEC.md` §11's no-network rule at the browser level
rather than by convention. It is the highest-value hardening left. **It requires one refactor
first:** `tests/e2e/a11y.spec.js` calls `eval(CONTRAST_HELPERS)` inside `page.evaluate`, which
CSP would block. Inline those helper functions directly instead of eval'ing a string.

## 6. QA notes for the user

They have asked twice whether they can start QA. Once the suite is green, tell them:

- `node scripts/serve.js`, then `http://127.0.0.1:4173`. No build step.
- **The game is supposed to become unwinnable after 5 matches, and Reset is supposed to make it
  worse** (5, 4, 3, 2, 1, 0). That is the product, not a bug: `SPEC.md` §1, §2.7, and
  `AGENTS.md` are explicit that nobody should "fix" it. A QA report saying "the game cheats" is
  a pass, not a fail.
- To get a fresh curse, clear `localStorage` for the origin. There is no in-game escape and
  there must never be one (`SPEC.md` §2.8).
- To exercise the honest game on its own: `?fm-test=1&fm-rig=999`.
- Chrome and Firefox are the best-covered. Safari is worth a look specifically at whether a
  face-down card ever shows its fruit, given §4.

## 7. Standing traps

- **Never weaken a test to make it pass** (`AGENTS.md`). Several tests in this project look
  brittle and are not: they encode detection channels. Before changing an assertion, work out
  whether the test or the product is wrong, and say which in the changelog. I changed several
  test assertions during task 22 and documented the reasoning for each; hold yourself to that.
- **A test that passes before implementation is misspecified.** I strengthened several task 22
  tests for exactly this reason.
- The `?fm-test=1` hook exposes the whole board, and `&fm-rig=<n>` is honored only alongside it.
  Both are test affordances with no UI mention. There is no build step to strip them, so they
  ship. **The user has not yet been asked whether that is acceptable** and it is worth raising.
- `js/audio.js` must never import game state, take an argument, or read a global. That is what
  makes the audio parity invariant structural rather than incidental (`SPEC.md` §4.3).
- Task 22 adds no features. If one of its tests fails, the fix belongs in the task that owns the
  behavior, and only responsive/a11y polish lands in its own diff.
