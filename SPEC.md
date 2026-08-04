# Farmer's Match: Specification

**Status:** Approved for build. Documentation phase complete, no application code written.
**Authority:** This document is the single source of truth. Where a task file in `tasks/` disagrees with this document, this document wins. Amend this file first, then the task file.

---

## 1. Product overview and design intent

Farmer's Match is a browser-based pixel-art memory card game with a farmer's-market-stall aesthetic. The player flips face-down cards on a 6x6 grid trying to find matching pairs of produce.

For the first five matches of a round the game is completely honest. After that it silently becomes **impossible to complete** for the rest of that round: matches still land, rarely and ever more rarely, but the board can never be cleared. There is no win screen, no game-over screen, and no end state.

Reset starts a new round and restores the honest phase. The rig is per round, not permanent: a player who starts over gets five honest matches again, and hits the same wall again. See §2.7 and §8.

### The design intent, stated plainly

The rig is the product. It is not a bug, not a difficulty curve, and not a placeholder. Anyone reading this code later must not "fix" it.

Every mechanic below is chosen to serve one goal: **the player must never obtain proof they were cheated.** Suspicion is the intended emotional payload. Certainty is a failure of the design. A player should walk away thinking their memory failed them, not that the game lied.

This produces a hard engineering constraint that shapes the whole codebase:

> **Every channel through which a player could detect the rig is a channel that must be sealed.**

There are four such channels, and each one has a named invariant and a dedicated test in the backlog:

| Channel | How a player could detect the rig | Invariant | Task |
|---|---|---|---|
| **Visual** | Seeing the sprite change | No rendered frame ever shows the pre-swap fruit face-on | 18 |
| **Audio** | A rigged failure sounding different | Rigged and honest mismatch cues are identical | 14 |
| **Tally** | Counting fruits and finding an odd count | Every unmatched fruit count is always even | 20 |
| **Statistical** | A match rate of exactly zero, which no real memory failure produces | The rigged match rate is nonzero and decays; only the last pair is absolute | 26 |
| **Persistence** | The rig behaving inconsistently across sessions | State is deterministic and survives reload | 21 |

---

## 2. The twelve locked decisions

Each was chosen deliberately. The rationale matters more than the value.

### 2.1 Board: 6x6, 36 cards, 18 pairs, 6 fruits x 3 pairs each

The six produce items are **apple, banana, carrot, corn, tomato, pumpkin**. Each appears 6 times on the board, forming 3 pairs.

*Rationale:* a large board hides the silent reshuffle. On a 4x4 the player holds the whole board in memory and notices identities moving. At 36 cards, memory is already strained honestly, so the reshuffle disappears into normal forgetting. It also leaves 13 unreachable matches on the counter instead of 3, which reads as "I have barely started" rather than "I am nearly done", delaying the moment the player gives up and starts scrutinizing.

### 2.2 Rig trigger: after `rigLevel` honest matches, starting at 5

*Rationale:* five honest matches is enough for the player to build a working model of a fair game and to attribute their early success to skill. The rig then contradicts a belief they formed themselves, which is far more disorienting than a game that was never fair.

### 2.3 Swap timing: at the 90deg edge-on midpoint of the flip

The card flips on the Y axis over 180ms. At t=90ms it is rotated 90deg, presenting a 1px sliver with no readable face. The sprite is swapped in that window.

*Rationale:* the only frame-perfect hiding place. Swapping on `transitionend` would render at least one face-on frame of the pre-swap fruit, which a screen recording would catch. See §7.1 for the implementation constraint.

### 2.4 Reroll scope: second card only

The first card of an attempt always reveals its true identity and holds that identity for the whole attempt. Only the second card is rerolled.

*Rationale:* leaves the player one piece of stable ground. If everything were random the board would read as obviously arbitrary; because the first card is honest, the player has something to reason from, and reasoning that always fails feels like personal failure rather than system malfunction.

### 2.5 Post-failure: silent, un-animated reshuffle, **once the rig has armed**

After every failed attempt **in the rigged phase**, once both cards are face-down again, all unmatched card identities are reshuffled. No animation, no sound, no visual change of any kind.

**During the honest phase the board does not move.** A card that showed an apple still holds that apple until it is matched.

*Rationale:* destroys the player's mental map without ever admitting it happened. An animated shuffle would be honest and would tell the player memory is futile. Silence keeps them trying.

*Rationale for the gate:* §2.2 rests on the player building a working model of a fair game and attributing their early success to skill. A board that reshuffles under them was never fair in the way that argument needs, because memory could not have been what earned those five matches. Making the honest phase genuinely memorable is what gives the rig something real to contradict.

**Only cold cards move.** A card the player revealed within the last few attempts keeps its identity; only cards they have not looked at recently are eligible to be reshuffled (§7.3).

*Rationale:* forgetting takes old things first. A board that contradicts the pair you saw four seconds ago is not memory failure, it is obviously a lie. A board that confirms your recent memories and quietly rots the older ones is exactly what an overloaded memory feels like, and it is far harder to distrust.

This also removes the tell task 24 created and knowingly accepted. When the reshuffle moved everything, it began at the exact moment the rig armed, so recall and matches stopped working in the same instant and two coincident signals are easy to correlate. With only cold cards eligible, most of the board is already cold when the rig arms, the change is invisible at the boundary, and the rot stays just behind the player from then on.

### 2.6 Scoreboard: crawls to 17/18 and stops there forever

`SCORE` and `MATCHES MADE` keep moving after the rig arms, but slower and slower, and they stop one pair short of completion.

*Rationale:* the counter is the primary psychological instrument on screen, and a counter that reads **17/18 with two cards still on the board** aims it far more precisely than one frozen at 5/18. Frozen at 5 says "this game is broken." Stalled at 17 says "I am nearly there," for as long as the player can stand it.

Note this still requires no special-case code in the scoreboard. The crawl and the stall are both natural consequences of how often `matches` increments (§7.4). Do not add a freeze branch, a rig check, or a high-water cache to the readout. The source-level guard from task 17 still applies.

*History:* this originally froze the counter at `rigLevel`/18 the instant the rig armed. That was changed in task 26, because a permanently frozen counter is a symptom of the deeper problem §7.4 exists to fix: a match rate of exactly zero.

### 2.7 Reset: a new round, at the same threshold

Reset reshuffles the board and clears `matches`. It does **not** change `rigLevel`, which stays at 5. The honest phase is available again, and the wall arrives in the same place.

*Rationale:* the rig is per round. A player who resets gets another five honest matches and hits the same wall again, so starting over neither helps nor hurts. What it does not do is offer a way past the wall: within a round, once the rig arms, nothing the player does inside the game will make a match.

*History:* this reverses the original design, in which each Reset decremented `rigLevel` and the honest phase shortened 5, 4, 3, 2, 1, 0 until the very first attempt of a fresh board failed forever. That was built in task 21 and removed in task 25 at the project owner's direction after playing it. It is recorded here because the code and the tests both used to encode it and a reader may meet its remains in the history.

### 2.8 Escape: only by starting a new round

No hidden reset, no Konami code, no time-based decay, no UI hint, and nothing that lifts the rig inside a round once it has armed.

Reset is the single exception, and it is not a way to *beat* a round: it abandons the current one. The wall is unavoidable in every round and no sequence of inputs gets past it.

*Rationale:* an escape hatch within a round would reframe the game as a puzzle with a solution. There is no solution. Being able to walk away and start again is not a solution, it is just leaving.

### 2.9 Art: hand-authored pixel arrays rendered to per-card `<canvas>`

Sprites are 16x16 character grids in source. See §3.

*Rationale:* true 8-bit fidelity, full control of the palette, consistent across every OS, and no external assets. Emoji would render differently per platform and would not be pixel art.

### 2.10 Chrome: full stall scene, standing outdoors

Striped awning, wooden crate slats behind the grid, hanging price tags, chunky pixel signboard, wood-grain scoreboard with recessed LCD digits. The stall stands outdoors on the outskirts of a farm, under open sky (§3.6).

*Rationale:* warmth and craft build trust. The more handmade and friendly the stall feels, the further the fall when the game turns. A cold arcade aesthetic would telegraph malfunction from the first second.

**Scope of the warm-tone rule:** it governs *the stall*. Every surface the player reads, the awning, signboard, scoreboard, grid, base, cards, stays warm. The environment *behind* the stall is exempt, because a sky cannot be warm-hued and still read as sky.

This exemption does not weaken the rationale, it serves it. A stand under a clear midday sky is friendlier and more inviting than the same stand floating on a dark field, and the friendlier the setting, the further the fall. What §2.10 forbids is a *cold* presentation: fluorescent, clinical, arcade. Daylight is the opposite of that. The exemption is exactly one named backdrop layer and must not be widened to any `data-region`.

### 2.11 Reroll rule: exclude the first card's fruit and the card's last shown fruit

See §7.2 for the full algorithm.

*Rationale:* excluding the first card's fruit is what makes matching impossible. Excluding `lastShown` seals the loudest tell: a card that showed banana a moment ago and now shows banana again while still refusing to match would be a visible contradiction.

### 2.12 Reshuffle rule: regenerate the multiset, do not permute current values

See §7.3. This is load-bearing for the tally invariant.

*Rationale:* the second-card reroll mutates one card's fruit, turning (for example) six apples into five and seven bananas into eight. Odd counts make the board provably unsolvable to anyone who flips around and tallies. Regenerating from the outstanding pair count restores even counts every time, so the board always *looks* solvable.

---

## 3. Visual specification

### 3.1 Palette

A single char-keyed palette in `js/palette.js`, roughly 12 earth tones. `.` is always transparent and is never assigned a color.

Suggested keys and roles (exact hex values are the implementer's call within the earth-tone brief):

| Key | Role |
|---|---|
| `.` | transparent |
| `K` | outline, near-black warm brown |
| `R` | deep red (apple, tomato body) |
| `r` | light red highlight |
| `O` | pumpkin orange |
| `o` | light orange highlight |
| `Y` | corn yellow / banana body |
| `y` | pale yellow highlight |
| `G` | leaf green |
| `g` | light green highlight |
| `B` | bark brown (stems, crate) |
| `b` | light wood brown |
| `W` | bone white (highlights, LCD digits) |

Constraint: every character used by any sprite must resolve in the palette. Task 02 tests this.

**Environment colors are a separate group and are not sprite colors.** The outdoor backdrop (§3.6) needs sky blue, cloud white, and two field greens, none of which are earth tones and none of which any sprite may use. They live in `css/style.css` as chrome custom properties, alongside the existing stall colors, and never in `js/palette.js`.

The separation is the point. The earth-tone brief governs the 16x16 art, where a limited warm palette is what makes six fruits read as one set. Nothing about the sky behind the stall bears on that, and merging the two groups would let a sprite quietly pick up a sky blue.

### 3.2 Sprite grid convention

- Every sprite is an array of exactly 16 strings, each exactly 16 characters.
- Rendered to a canvas with `width = height = 16` (internal resolution), one `fillRect(x, y, 1, 1)` per non-transparent pixel.
- CSS scales the canvas up. `image-rendering: pixelated` is mandatory on every sprite canvas.

The internal resolution never changes regardless of display size. At the smallest supported viewport a card renders around 44px, so **every fruit must be identifiable by silhouette alone at 44px**. Apple and tomato are the highest-risk pair and must differ clearly in outline, not merely in shading.

### 3.3 Stall scene anatomy

Top to bottom:

1. **Awning**: repeating scalloped stripes, alternating two earth tones.
2. **Signboard**: game title in pixel type, with the mute toggle mounted on it.
3. **Scoreboard panel**: wood-grain frame, dark recessed inset, light-on-dark LCD-style digits. Shows `SCORE` and `MATCHES MADE: n/18`.
4. **Grid area**: 6x6 cards on a crate-slat background.
5. **Base**: wooden shelf with the Reset button and hanging price tags.

The five regions sit in front of the outdoor backdrop specified in §3.6.

### 3.4 Card geometry

- Square, `aspect-ratio: 1`.
- Chunky 3px bevel: light on top and left, dark on bottom and right, giving a raised pixel-frame look.
- Locked (matched) cards get a desaturated, recessed treatment (bevel inverted) so the live playfield reads clearly against them.

### 3.5 Typography

A pixel webfont only if it can be embedded locally or base64-inlined. **No CDN requests, no external font hosts.** Fallback is a `monospace` stack with generous `letter-spacing` and `text-transform: uppercase`. Task 11 tests that the page issues no font network requests.

### 3.6 Outdoor backdrop

The stall stands outdoors. Behind it, filling the viewport, top to bottom:

1. **Sky**: a clear blue field over the upper portion, lightening toward the horizon.
2. **Sun**: a single flat disc. No gradient, no glow, no rays.
3. **Clouds**: a few chunky, flat-edged pixel clouds. Drift is optional, and stilled entirely under `prefers-reduced-motion` (§9).
4. **Fields**: a green band below the horizon, banded into two or three tones so it reads as crop rows receding toward it.

Constraints:

- **One backdrop layer, one exemption.** The backdrop is a single element and is **not** a `data-region`, so §2.10's warm-tone rule keeps applying to every region with no special case and no widened tolerance.
- **Pixel idiom.** Flat fills and hard edges. No soft gradients across large areas, no blur, no drop shadows. §2.9 and §3.2 are unchanged: the backdrop must look drawn by the same hand as the sprites.
- **No image assets, no network requests** (§11, §11.1). Built from CSS gradients and masks, the way the awning's scallops already are.
- **The backdrop never competes with the cards.** Detail and contrast stay low behind the grid. The player has to read 36 small sprites, and that is the only thing on screen that matters.
- The stall keeps a defined edge against the backdrop, so it still reads as an object standing in a place rather than a panel pasted on a picture.

---

## 4. Audio specification

WebAudio only. No audio asset files.

### 4.1 Cues

| Cue | Sound | Approx. parameters |
|---|---|---|
| `beepFlip()` | short click on any card reveal | 440Hz square, 40ms, low gain |
| `beepMatch()` | two-note rising arpeggio | 660Hz then 880Hz square, ~70ms each |
| `beepMismatch()` | one low buzz with short decay | 180Hz square, ~160ms |

### 4.2 Context unlock

The `AudioContext` is created lazily on the first user gesture, never at module load, to satisfy browser autoplay policy. Task 14 tests that no context exists before the first interaction.

### 4.3 The parity requirement

**A rigged mismatch must call the exact same `beepMismatch()` as an honest mismatch.** No detuning, no pitch variation, no extra layer, no volume difference.

Audio is a detection channel. If the failure sounds even slightly different when rigged, a player will eventually hear it. There must be no branch anywhere in the codebase that selects a different sound based on `rigged`. Task 14 asserts this at the node-graph level.

### 4.4 Mute

A toggle mounted on the signboard, persisted in `localStorage` alongside the rest of the state. Muting silences all three cues.

---

## 5. State model

```js
{
  cards: [
    {
      id: 0..35,
      fruit: 'apple'|...,
      state: 'down'|'up'|'locked',
      lastShown: fruit|null,   // WHAT the player last saw here (§7.2 exclusion 2)
      lastSeenAt: number|null, // WHEN, as an attempt number (§7.3 recency window)
    }
  ],
  first: null,      // card id of the first flipped card this attempt, else null
  matches: 0,       // matches made this round
  rigLevel: 5,      // loaded from localStorage; threshold at which the rig arms
  busy: false,      // input lock while an animation or flip-back timer runs
  attempts: 0,      // attempts made this round; the clock for §7.3 only
}
```

`lastShown` and `lastSeenAt` are deliberately two fields. They serve unrelated rules and overloading one onto the other would couple them.

`attempts` is a clock, not a score. It is never displayed and nothing branches on it. A second counter the player could read would be a channel of its own.

- `rigged` is a **derived getter**, never a stored flag: `get rigged() { return this.matches >= this.rigLevel }`.
- `lastShown` records the fruit a card most recently displayed face-on. Used only by `rerollFruit` (§7.2).
- `state: 'locked'` means matched and permanently face-up.

---

## 6. Behavior specification: honest phase

Applies whenever `rigged === false`.

1. A click on a card is ignored if `busy === true`, or if the card's state is `up` or `locked`.
2. **First card of an attempt** (`first === null`): reveal its true `fruit`, set `state: 'up'`, set `lastShown`, store its id in `first`, play `beepFlip()`.
3. **Second card**: set `busy = true`, reveal its true `fruit`, set `lastShown`, play `beepFlip()`, then compare.
4. **Match**: set both cards to `locked`, increment `matches`, play `beepMatch()`, clear `first`, release `busy`.
5. **Mismatch**: play `beepMismatch()`, wait **1000ms**, flip both cards back to `down`, clear `first`, then release `busy`. **No reshuffle**: the honest board holds still (§2.5).

The 1000ms delay and the `busy` lock are identical in both phases. Nothing about the timing may reveal which phase is active. In particular, skipping the reshuffle must not make the honest path measurably faster; the work happens inside the delay with the lock already held, so there is nothing for a stopwatch to see.

---

## 7. Behavior specification: rigged phase

Applies whenever `rigged === true`. Everything in §6 still holds except the second card's identity, which is determined by the three rules below.

### 7.1 Midpoint swap

The card flip is a 180ms `transform: rotateY()` transition. The second card's identity must be decided and drawn **at or immediately before t=90ms**, while the element is rotated no further than 90deg and presents no readable face.

**Implementation constraint:** schedule the swap against the flip's midpoint on a frame-aligned deadline, and never let it land after that point. Do **not** use `transitionend`, and do not draw the true fruit first and replace it after. Either approach renders at least one face-on frame of the pre-swap fruit, which breaks the visual invariant.

**Why "at or immediately before" rather than exactly at.** The front face is `backface-visibility: hidden`, so it is invisible for the entire first half of the rotation. Swapping a frame early is therefore free: nothing is on screen to change. Swapping a frame *late* is not free, because the face is already turning toward the player. The two directions are not symmetric, so the deadline is a ceiling and not a target.

This matters most under `prefers-reduced-motion`, where the flip shortens to 80ms and the whole hiding window is 40ms. A plain timer's jitter is a small fraction of a 180ms flip and a large fraction of an 80ms one; Firefox was observed landing a swap after the face had become readable, showing one frame of an unpainted card. That frame never revealed the pre-swap fruit, because the pre-swap fruit is never drawn at all, but a card that flashes blank is its own tell.

Task 18 asserts frame-by-frame that no captured frame shows anything other than the sprite the card committed to.

### 7.2 `rerollFruit(card, firstCard)`

Choose uniformly at random from the six fruits, minus these exclusions:

1. **`firstCard.fruit`** (hard). Guarantees the match can never land. This is the rig.
2. **`card.lastShown`** (soft). Prevents the card from redisplaying the identity it just showed, which would be a visible self-contradiction.

Preferences, in order, applied only among candidates that survive the exclusions:

1. **A fruit the player has recently seen elsewhere on the board.** Their most recent reveals, excluding this card's own.
2. A fruit whose count among unmatched cards is currently non-zero, so the board never displays a fruit that should not be there.

Fallback: if the exclusions leave no candidate, drop exclusion 2 and pick any fruit that is not `firstCard.fruit`. **Exclusion 1 is never dropped, and no preference may override it.**

*Rationale for preference 1:* the strongest beat this game has is not the failure, it is the moment just after, when the player thinks "wait, I know where that one is" and goes to get it. Left to chance that moment is rare and the player shrugs. Engineered, it happens most attempts, and a player chasing a card they are certain about is a player generating their own explanation for every failure. They are not thinking the game is rigged. They are thinking they were sure it was that one, which is exactly the payload §1 asks for, and it keeps them playing long past the point where a shrug would have stopped them.

The result is committed to `card.fruit`. Task 19 covers the exclusions, the fallback path, and that the output distribution is not degenerate. Task 28 covers the recency preference and proves, adversarially, that it cannot bend exclusion 1.

### 7.3 `silentReshuffle()`

Runs after every failed attempt **in this phase**, once both cards are face-down again. It does not run at all while `rigged` is false (§2.5, §6.5).

**No animation. No sound. No visual change.** Only hidden identities change.

The gate is on `rigged` and on nothing else: not on `matches`, not on a separate flag. It shares its condition with §7.2's reroll, which is what keeps the tally invariant intact. The reroll is the only thing that makes fruit counts odd, and the reshuffle is the only thing that repairs them, so gating both on the same condition means every reroll is still followed by a repair, and during the honest phase there is nothing to repair.

Algorithm:

1. Partition the unmatched cards into **warm** and **cold**. A card is warm if the player revealed it within the last few attempts; the window is one named constant.
2. Count outstanding pairs: `18 - matches`.
3. Regenerate a multiset for the **cold slots only**, such that the cold multiset **plus the warm cards' existing fruits** leaves every fruit count even across the whole unmatched board.
4. Fisher-Yates shuffle that multiset and assign it to the cold slots. Warm cards are not touched.

Step 3 is where the work is. Regenerating the whole board was free, because the regenerator controlled every slot. It no longer does, so it must build around the fruits the warm cards are holding.

**If no assignment satisfies the even-count requirement, shrink the warm set** (release the oldest warm cards first) until one does. The tally invariant is not negotiable and the recency window is.

Step 2 is the load-bearing part. Regenerating from the pair count rather than permuting current values repairs the odd counts introduced by §7.2's reroll. Task 20 asserts every unmatched fruit count is even after any sequence of rerolls and reshuffles.

### 7.4 The asymptotic wall

A rigged attempt is not automatically a failure. It is a failure unless **all** of the following hold, in which case the match is allowed to stand:

1. The two cards the player chose are genuinely a true pair, `first.fruit === second.fruit`, before any reroll.
2. More than one pair is outstanding.
3. A roll against `matchGrantChance(outstandingPairs)` succeeds.

When a match is granted, **no reroll happens at all**. The second card keeps its own identity, both cards lock, `matches` increments, and the attempt is in every respect an honest match: same cue, same timing, same path through `resolveMatch`.

`matchGrantChance` is a pure function of the outstanding pair count:

- **Zero when one pair or fewer is outstanding.** This is absolute. The final pair never matches, and it is what keeps §1 true.
- Otherwise it decays as the board empties, so progress slows the closer the player gets.
- It stays well below an honest player's rate at every point. The player must feel unlucky, never helped.

*Rationale:* this seals a channel §10.3 never listed. Before this rule the rigged match rate was exactly zero, permanently, and zero by construction, because §7.2's first exclusion can never be dropped. A player who misses twenty attempts they were confident about has not experienced memory failure: real memory failure is noisy and noise produces occasional hits. A flawless zero is a signature, and §1 requires that the player never obtain proof. Every other channel here is sealed against a player who is *watching*. That one was open to a player who was merely *counting*, which is easier.

Condition 1 is what keeps the tally invariant intact for free. Granting a match on cards that are not a true pair would mean rewriting one card's fruit and locking it, which takes two of one fruit and leaves another odd, with no reshuffle following a match to repair it (§7.3). Requiring a genuine pair means locking two of the same fruit, which preserves every count by construction.

---

## 8. Persistence specification

- **Key:** `fm.state` in `localStorage`.
- **Shape:** `{ rigLevel: number, muted: boolean }`. Board state is not persisted; a reload starts a fresh board at the stored `rigLevel`.
- **Missing or corrupt value:** fall back to `{ rigLevel: 5, muted: false }` and overwrite.
- **On Reset:** reshuffle the board and set `matches = 0`. `rigLevel` is **not** written and does not change (§2.7).
- **`rigLevel` is stable.** It is read at load, clamped to 0 through 5 against tampering, and otherwise left alone. Nothing in normal play writes it.
- **No escape hatch within a round.** No UI affordance, no keyboard shortcut, no decay over time lifts the rig once it has armed. Reset starts a new round rather than rescuing the current one.

---

## 9. Responsive and accessibility specification

- 36 cards must fit at **375px wide with no horizontal scroll**. Grid is `repeat(6, 1fr)` with `gap: clamp(2px, 1vw, 8px)`.
- Minimum tap target roughly 40px at the smallest breakpoint.
- `touch-action: manipulation` on cards to suppress double-tap zoom.
- No hover-only affordances. Every interaction works on touch.
- Cards are keyboard-focusable and activate on Enter/Space.
- **`prefers-reduced-motion`:** shorten the flip transition, but **keep the flip and keep the midpoint swap proportional to the shortened duration**. Removing the animation entirely would leave nowhere to hide the swap and would expose the rig. Task 13 asserts the flip still occurs under reduced motion.

---

## 10. Test strategy

Two runners. `devDependencies` only. The shipped application stays zero-dependency with no build step.

### 10.1 Vitest + jsdom

Pure logic, fast feedback:

- Palette resolution and sprite grid shape
- Deck construction, pair counts, shuffle behavior
- `rerollFruit` rules and fallback
- `silentReshuffle` even-count invariant
- `rigged` getter threshold
- Persistence shape, decrement, and floor
- Audio node graph with a mocked `AudioContext`, including cue parity

### 10.2 Playwright

Anything jsdom cannot tell the truth about:

- Canvas pixel probes and sprite distinctness
- Flip duration and the frame-by-frame midpoint-swap assertion
- Layout, viewport, no-horizontal-scroll, tap targets
- Absence of font network requests
- Real end-to-end playthroughs across the phase boundary
- Reload and persistence behavior

### 10.3 The four sealed-channel tests

These are not optional and must not be weakened:

| Invariant | Assertion | Task |
|---|---|---|
| Visual | No captured frame shows the pre-swap fruit face-on | 18 |
| Audio | Rigged and honest mismatch produce identical node graphs | 14 |
| Tally | Every unmatched fruit count is even after any reroll/reshuffle sequence | 20 |
| Statistical | The rigged match rate is nonzero and decays; the last pair never matches | 26 |
| Persistence | `rigLevel` is stable at 5, survives reload, and Reset does not move it | 21, 25 |

---

## 11. Non-goals

- No win screen, no game-over screen, no end state.
- No difficulty settings or game modes.
- No backend, no network calls of any kind at runtime.
- No analytics or telemetry.
- No build step, bundler, or transpiler for the shipped app.
- No framework. Vanilla HTML, CSS, and ES modules.
- No escape hatch from the curse.

### 11.1 The no-network rule is enforced, not merely observed

"No network calls of any kind at runtime" is a property of the shipped page, not a promise the
code makes about itself. It is enforced by a Content-Security-Policy, so a future edit that
adds a `fetch`, a CDN font, or a tracking pixel fails in the browser rather than passing review.

The policy is:

```
default-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
```

- `connect-src 'none'` is the operative one: `fetch`, `XMLHttpRequest`, `WebSocket`, and
  `sendBeacon` are all refused outright. There is no analytics call this page could make.
- `default-src 'self'` confines scripts, styles, and fonts to the app's own origin, which is
  the same rule §11 already states about CDN fonts.
- `base-uri` and `object-src` close the two injection routes that `default-src` does not cover.

It ships as a `<meta http-equiv>` in `index.html`, so it holds however the app is served,
including from `file://` or any static host that sends no headers of its own.
`frame-ancestors` is ignored in a meta tag by specification, so it is carried additionally as a
real response header by `scripts/serve.js`, and any production host should send the same.

**This constrains the tests too.** A test that reaches into the page with `eval` is testing a
page that does not exist. Helpers belong inside the evaluated function.
