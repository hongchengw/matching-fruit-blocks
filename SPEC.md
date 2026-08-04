# Farmer's Match: Specification

**Status:** Approved for build. Documentation phase complete, no application code written.
**Authority:** This document is the single source of truth. Where a task file in `tasks/` disagrees with this document, this document wins. Amend this file first, then the task file.

---

## 1. Product overview and design intent

Farmer's Match is a browser-based pixel-art memory card game with a farmer's-market-stall aesthetic. The player flips face-down cards on a 6x6 grid trying to find matching pairs of produce.

For the first five matches the game is completely honest. After that it silently becomes **impossible to win**, and it never stops. There is no win screen, no game-over screen, and no end state.

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
| **Persistence** | The curse behaving inconsistently across sessions | State is deterministic and survives reload | 21 |

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

### 2.5 Post-failure: silent, un-animated reshuffle

After every failed attempt, once both cards are face-down again, all unmatched card identities are reshuffled. No animation, no sound, no visual change of any kind.

*Rationale:* destroys the player's mental map without ever admitting it happened. An animated shuffle would be honest and would tell the player memory is futile. Silence keeps them trying.

### 2.6 Scoreboard: freezes at `rigLevel`/18 forever

`SCORE` and `MATCHES MADE` stop moving the instant the rig arms.

*Rationale:* the frozen counter is the primary psychological instrument on screen, and its 13 dangling matches are permanently visible. Note this requires no special-case code: the freeze is a natural consequence of `matches` never incrementing again. Do not add logic to force it.

### 2.7 Reset: the curse compounds, 5 -> 4 -> 3 -> 2 -> 1 -> 0

Each press of Reset decrements `rigLevel` by 1, floored at 0. Persisted to `localStorage`.

*Rationale:* punishes the instinct to start over. The player's natural response to being stuck is to reset, and each reset shortens the honest phase until at `rigLevel: 0` the very first attempt of a fresh board fails. Trying harder makes it worse.

### 2.8 Escape: none

No hidden reset, no Konami code, no time-based decay, no UI hint. Clearing browser storage is the only way out and the game never mentions it.

*Rationale:* an escape hatch would reframe the game as a puzzle with a solution. There is no solution.

### 2.9 Art: hand-authored pixel arrays rendered to per-card `<canvas>`

Sprites are 16x16 character grids in source. See §3.

*Rationale:* true 8-bit fidelity, full control of the palette, consistent across every OS, and no external assets. Emoji would render differently per platform and would not be pixel art.

### 2.10 Chrome: full stall scene

Striped awning, wooden crate slats behind the grid, hanging price tags, chunky pixel signboard, wood-grain scoreboard with recessed LCD digits.

*Rationale:* warmth and craft build trust. The more handmade and friendly the stall feels, the further the fall when the game turns. A cold arcade aesthetic would telegraph malfunction from the first second.

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

### 3.4 Card geometry

- Square, `aspect-ratio: 1`.
- Chunky 3px bevel: light on top and left, dark on bottom and right, giving a raised pixel-frame look.
- Locked (matched) cards get a desaturated, recessed treatment (bevel inverted) so the live playfield reads clearly against them.

### 3.5 Typography

A pixel webfont only if it can be embedded locally or base64-inlined. **No CDN requests, no external font hosts.** Fallback is a `monospace` stack with generous `letter-spacing` and `text-transform: uppercase`. Task 11 tests that the page issues no font network requests.

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
    { id: 0..35, fruit: 'apple'|..., state: 'down'|'up'|'locked', lastShown: fruit|null }
  ],
  first: null,      // card id of the first flipped card this attempt, else null
  matches: 0,       // honest matches made this run
  rigLevel: 5,      // loaded from localStorage; threshold at which the rig arms
  busy: false,      // input lock while an animation or flip-back timer runs
}
```

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
5. **Mismatch**: play `beepMismatch()`, wait **1000ms**, flip both cards back to `down`, clear `first`, then run `silentReshuffle()` (§7.3), then release `busy`.

The 1000ms delay and the `busy` lock are identical in both phases. Nothing about the timing may reveal which phase is active.

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

Preference: among the remaining candidates, prefer fruits whose count among unmatched cards is currently non-zero, so the board never displays a fruit that should not be there.

Fallback: if the exclusions leave no candidate, drop exclusion 2 and pick any fruit that is not `firstCard.fruit`. Exclusion 1 is never dropped.

The result is committed to `card.fruit`. Task 19 covers all four properties plus the fallback path, and asserts the output distribution is not degenerate (the reroll must not always return the same fruit).

### 7.3 `silentReshuffle()`

Runs after every failed attempt, once both cards are face-down again.

**No animation. No sound. No visual change.** Only hidden identities change.

Algorithm:

1. Count outstanding pairs: `18 - matches`.
2. Regenerate the unmatched multiset from that pair count, distributing across the six fruits so **every fruit count is even**.
3. Fisher-Yates shuffle the multiset and assign to the unmatched cards.

Step 2 is the load-bearing part. Regenerating from the pair count rather than permuting current values repairs the odd counts introduced by §7.2's reroll. Task 20 asserts every unmatched fruit count is even after any sequence of rerolls and reshuffles.

---

## 8. Persistence specification

- **Key:** `fm.state` in `localStorage`.
- **Shape:** `{ rigLevel: number, muted: boolean }`. Board state is not persisted; a reload starts a fresh board at the stored `rigLevel`.
- **Missing or corrupt value:** fall back to `{ rigLevel: 5, muted: false }` and overwrite.
- **On Reset:** reshuffle the board, `matches = 0`, `rigLevel = Math.max(0, rigLevel - 1)`, write to storage.
- **At `rigLevel: 0`:** `rigged` is true from the first attempt of a fresh board. The player never makes a single match again.
- **No escape hatch.** No UI affordance, no keyboard shortcut, no decay over time clears the curse.

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
| Persistence | `rigLevel` decrements to a floor of 0 and survives reload | 21 |

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
