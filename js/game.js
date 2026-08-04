/**
 * Farmer's Match. See SPEC.md §5 and §6.
 *
 * Layout of this file, which later tasks extend rather than reorganize:
 *
 *   1. Pure deck helpers (task 15)  - no state, no DOM, independently testable
 *   2. State machine   (task 16)
 *   3. Rendering       (task 16)
 */
import { FRUITS, CARD_BACK, drawSprite } from './sprites.js';
import { beepFlip, beepMatch, beepMismatch, isMuted, toggleMute } from './audio.js';

export { FRUITS };

/** 36 cards, 18 pairs, 6 fruits x 3 pairs each (SPEC.md §2.1). */
export const CARD_COUNT = 36;
export const PAIR_COUNT = CARD_COUNT / 2;

// ---------------------------------------------------------------------------
// Deck
// ---------------------------------------------------------------------------

/**
 * Fisher-Yates, returning a new array.
 *
 * Copies first because the caller's array is never ours to reorder, and because
 * silentReshuffle (task 20) regenerates a multiset and shuffles it separately
 * from the board it is about to overwrite.
 *
 * `random` is injectable so tests can be deterministic.
 */
export function shuffle(items, random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    // i is inclusive: the last element has to be able to move, or the shuffle
    // is biased and position 35 keeps whatever it started with.
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The 36 fruit names of a full board: six of each, so three pairs each. */
export function buildFruitMultiset() {
  return FRUITS.flatMap((fruit) => Array(CARD_COUNT / FRUITS.length).fill(fruit));
}

/** A fresh shuffled board. Every card face down, nothing shown yet. */
export function buildDeck(random = Math.random) {
  return shuffle(buildFruitMultiset(), random).map((fruit, id) => ({
    id,
    fruit,
    state: 'down',
    lastShown: null,
  }));
}

/**
 * A multiset of `pairs` pairs spread over the six fruits, every count even.
 *
 * Regenerated from the pair count rather than derived from what is on the
 * board, which is the entire point: see `silentReshuffle`.
 */
export function buildEvenMultiset(pairs, random = Math.random) {
  const perFruit = FRUITS.map(() => Math.floor(pairs / FRUITS.length));
  // Hand out the leftover pairs at random so the surplus fruit is not always
  // the first one in the list.
  const spare = shuffle([...FRUITS.keys()], random);
  for (let i = 0; i < pairs % FRUITS.length; i += 1) {
    perFruit[spare[i]] += 1;
  }
  return FRUITS.flatMap((fruit, i) => Array(perFruit[i] * 2).fill(fruit));
}

/**
 * Reshuffle every unmatched identity, silently (SPEC.md §7.3).
 *
 * No animation, no sound, no visual change. Only hidden identities move. An
 * animated shuffle would be honest, and would tell the player that memory is
 * futile; silence keeps them trying.
 *
 * The multiset is **regenerated** from the outstanding pair count, never
 * permuted from the current values. Permuting is the intuitive implementation
 * and it is wrong: task 19's reroll leaves one fruit with an odd count, and a
 * permutation preserves that faithfully, so a player who flips around and
 * tallies finds a provably unsolvable board. Regenerating repairs it every
 * time, and the board always looks solvable.
 *
 * `lastShown` is deliberately left alone; task 19's exclusion 2 depends on it.
 */
export function silentReshuffle(cards, matches, random = Math.random) {
  const unmatched = cards.filter((card) => card.state !== 'locked');
  const fruits = shuffle(buildEvenMultiset(PAIR_COUNT - matches, random), random);
  unmatched.forEach((card, index) => {
    card.fruit = fruits[index];
  });
  return cards;
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

/**
 * How long a mismatched pair stays face up (SPEC.md §6).
 *
 * Load-bearing. The rigged phase must use this same delay and this same busy
 * lock, so nothing about the timing tells the player which phase is running.
 * There is one path through a failed attempt, not two.
 */
export const MISMATCH_DELAY_MS = 1000;

/** Honest matches before the rig arms (SPEC.md §2.2). */
export const DEFAULT_RIG_LEVEL = 5;

// ---------------------------------------------------------------------------
// Persistence (SPEC.md §8)
// ---------------------------------------------------------------------------

export const STORAGE_KEY = 'fm.state';

/**
 * `rigLevel` only ever walks down from the default, so anything outside 0 to 5
 * is either tampering or corruption. Clamping keeps the state readable instead
 * of letting a hand-edited value produce a board the rest of the code cannot
 * reason about.
 */
function sanitizeRigLevel(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_RIG_LEVEL;
  return Math.min(DEFAULT_RIG_LEVEL, Math.max(0, Math.trunc(value)));
}

/**
 * Read `fm.state`, repairing it in place if it is missing or unusable.
 *
 * Wrapped because private browsing can throw on access, and a crash on load
 * would be a very loud tell.
 *
 * `muted` is carried through rather than owned here: js/audio.js is the only
 * module that acts on it, and it deliberately imports nothing from this file.
 */
export function loadState() {
  let parsed = null;
  try {
    parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    parsed = null;
  }

  if (!parsed || typeof parsed !== 'object') {
    const defaults = { rigLevel: DEFAULT_RIG_LEVEL, muted: false };
    writeState(defaults);
    return defaults;
  }

  return { rigLevel: sanitizeRigLevel(parsed.rigLevel), muted: parsed.muted === true };
}

function writeState(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable. The setting still applies for this session.
  }
}

/**
 * Read-modify-write, so the sibling `muted` key that js/audio.js owns survives.
 * Board state is never written: a reload starts a fresh board at the stored
 * threshold.
 */
export function saveState(partial) {
  writeState({ ...loadState(), ...partial });
}

/** Fallback flip duration when no stylesheet is present, as in jsdom. */
export const DEFAULT_FLIP_MS = 180;

/**
 * The flip duration CSS is currently using.
 *
 * Read rather than hardcoded, because reduced motion shortens it. The midpoint
 * has to follow the duration or the swap lands somewhere readable.
 */
export function readFlipMs() {
  if (typeof document === 'undefined') return DEFAULT_FLIP_MS;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--fm-flip-ms');
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_FLIP_MS;
}

/** One display frame at 60Hz, near enough. */
const FRAME_MS = 1000 / 60;

/**
 * When the card is edge-on: half the rotation, so a 1px sliver with no
 * readable face (SPEC.md §2.3). The only frame-perfect hiding place there is.
 *
 * A ceiling, not a target (SPEC.md §7.1). The deadline backs off by a frame so
 * that ordinary timer jitter cannot push the swap past 90deg, where the face
 * has started turning toward the player. Early is invisible, because the front
 * face is `backface-visibility: hidden` for the whole first half of the
 * rotation. Late is not.
 */
export function flipMidpoint(flipMs) {
  return Math.max(0, flipMs / 2 - FRAME_MS);
}

/** How many unmatched cards currently carry each fruit. */
export function unmatchedCounts(cards) {
  return cards.reduce((counts, card) => {
    if (card.state !== 'locked') counts[card.fruit] = (counts[card.fruit] ?? 0) + 1;
    return counts;
  }, {});
}

/**
 * Pick what the second card will show instead (SPEC.md §7.2).
 *
 * Two exclusions, and they are not equal in status:
 *
 *   1. the first card's fruit, hard. Never dropped. This single rule is what
 *      makes the match impossible, and it is the whole rig.
 *   2. the fruit this card just showed, soft. Dropped only if keeping it would
 *      leave nothing to pick. Without it a card can show banana, refuse to
 *      match, and show banana again: a contradiction the player can see.
 *
 * Then a preference, not a filter: favor fruits that are still in play, so the
 * board never displays produce that should not be there. If the preference
 * empties the pool it is ignored, never exclusion 1.
 *
 * Pure, and knows nothing about `matches`, `rigLevel`, or `rigged`. Task 18
 * owns the decision to call it at all.
 *
 * `fruits` is injectable only so the fallback branch is reachable in a test:
 * with all six, the two exclusions can never empty the candidate set.
 */
export function rerollFruit(card, firstCard, counts = {}, random = Math.random, fruits = FRUITS) {
  const withoutFirst = fruits.filter((fruit) => fruit !== firstCard.fruit);
  const candidates = withoutFirst.filter((fruit) => fruit !== card.lastShown);

  const pool = candidates.length > 0 ? candidates : withoutFirst;
  const inPlay = pool.filter((fruit) => (counts[fruit] ?? 0) > 0);
  const choices = inPlay.length > 0 ? inPlay : pool;

  return choices[Math.floor(random() * choices.length)];
}

/**
 * The game as a small state machine over SPEC.md §5.
 *
 * `onChange` is the only way out: the caller renders, the machine never touches
 * the DOM. That keeps the loop testable under jsdom with no markup at all.
 */
export function createGame({
  deck = buildDeck(),
  onChange = () => {},
  rigLevel = DEFAULT_RIG_LEVEL,
  random = Math.random,
  reroll = (card, first, cards) => rerollFruit(card, first, unmatchedCounts(cards), random),
  flipMs = null,
} = {}) {
  const state = {
    cards: deck,
    first: null,
    matches: 0,
    rigLevel,
    busy: false,

    /**
     * Derived, never stored (SPEC.md §5). A stored flag could drift out of sync
     * with `matches` and leave an accidentally winnable board.
     */
    get rigged() {
      return this.matches >= this.rigLevel;
    },
  };

  /** Card id whose face is deliberately unpainted until the midpoint. */
  let swapping = null;

  const cardAt = (id) => state.cards.find((card) => card.id === id);

  /** First card of an attempt: always honest, always its own fruit. */
  function reveal(card) {
    card.state = 'up';
    card.lastShown = card.fruit;
    beepFlip();
  }

  function resolveMatch(first, second) {
    first.state = 'locked';
    second.state = 'locked';
    state.matches += 1;
    state.first = null;
    state.busy = false;
    beepMatch();
  }

  function resolveMismatch(first, second, rigged) {
    beepMismatch();
    setTimeout(() => {
      first.state = 'down';
      second.state = 'down';
      state.first = null;
      /*
       * Only once the rig has armed (SPEC.md §2.5, §6.5, §7.3). The honest
       * board holds still, so the five matches the player earns are earned by
       * memory and the rig has something real to contradict.
       *
       * Gated on `rigged` and nothing else, sharing its condition with the
       * reroll. That is what keeps the tally invariant: the reroll is the only
       * thing that makes fruit counts odd, this is the only thing that repairs
       * them, and while they share a condition every reroll is still followed
       * by a repair.
       *
       * Still inside the delay and still before the lock is released, so no
       * frame can show the board changing and no stopwatch can see the honest
       * path skipping work.
       */
      if (rigged) silentReshuffle(state.cards, state.matches, random);
      state.busy = false;
      onChange(state);
    }, MISMATCH_DELAY_MS);
  }

  /**
   * The one place clicks enter the system.
   *
   * Every guard lives at the top. Duplicating any of them elsewhere is how the
   * rigged and honest paths would drift apart later.
   */
  function flip(id) {
    const card = cardAt(id);
    if (state.busy || !card || card.state !== 'down') return false;

    if (state.first === null) {
      reveal(card);
      state.first = id;
      onChange(state);
      return true;
    }

    state.busy = true;
    const first = cardAt(state.first);

    // Captured before the outcome is resolved: a match increments `matches`,
    // which could flip the getter true between here and the swap deadline and
    // reroll a card that had already matched.
    const rigged = state.rigged;

    revealSecond(card, first, rigged);

    if (rigged) {
      // Always a mismatch by construction, so the outcome is settled now rather
      // than after the swap. The cue and the 1000ms timer therefore start at
      // the same point in the attempt as they do honestly, and the two phases
      // are indistinguishable by ear or by stopwatch.
      resolveMismatch(first, card, rigged);
    } else if (first.fruit === card.fruit) {
      resolveMatch(first, card);
    } else {
      // `rigged` was captured before the outcome was resolved, and is false
      // here by construction, but pass it rather than re-reading the getter:
      // the two call sites must not be able to disagree.
      resolveMismatch(first, card, rigged);
    }

    onChange(state);
    return true;
  }

  /**
   * Reveal the second card without deciding what it is yet (SPEC.md §7.1).
   *
   * The rotation starts immediately, but the face stays unpainted until the
   * card is edge-on. Nothing ever draws the true fruit, so there is no
   * pre-swap frame to catch: not a frame that is hard to see, none at all.
   *
   * Deliberately a timer, and never the transition's completion event, which
   * fires once the card is face-on again and would guarantee the very frame
   * this seals off.
   */
  /**
   * Reveal the second card of an attempt (SPEC.md §7.1).
   *
   * The rotation starts immediately, but the face stays unpainted until the
   * card is edge-on. Nothing ever draws the pre-swap fruit, so there is no
   * pre-swap frame to catch: not a frame that is hard to see, none at all.
   *
   * Both phases go through here, and both paint at the same deadline. Only the
   * choice of fruit differs, and that choice is invisible. Painting the honest
   * card sooner would cost nothing on an engine that honors
   * `backface-visibility`, but WebKit does not, and there an honest face that
   * appeared instantly beside a rigged face that appeared half a flip later
   * would be a tell that needs no screen recording to spot.
   */
  function revealSecond(card, first, rigged) {
    card.state = 'up';
    swapping = card.id;
    beepFlip();

    const deadline = flipMidpoint(flipMs ?? readFlipMs());
    let committed = false;

    const commit = () => {
      if (committed) return;
      committed = true;
      if (rigged) card.fruit = reroll(card, first, state.cards);
      card.lastShown = card.fruit;
      swapping = null;
      onChange(state);
    };

    // Two racing deadlines, and the swap takes whichever arrives first. The
    // frame loop is the one that matters: it lands the swap on a real rendered
    // frame rather than whenever the event loop gets around to a timer, which
    // is what kept a shortened flip from overshooting 90deg. The timer is the
    // fallback for when frames are not being served at all, such as a
    // backgrounded tab.
    setTimeout(commit, deadline);
    if (typeof requestAnimationFrame === 'function') {
      const started = performance.now();
      const tick = () => {
        if (committed) return;
        if (performance.now() - started >= deadline) commit();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  /**
   * Start over, at a cost (SPEC.md §2.7).
   *
   * Every press shortens the honest phase by one, floored at zero, and the
   * page says nothing about it. The player's instinct when stuck is to reset,
   * and the reset is what makes it worse. No confirmation, no warning, no hint.
   */
  function reset() {
    state.rigLevel = Math.max(0, state.rigLevel - 1);
    state.matches = 0;
    state.first = null;
    state.busy = false;
    swapping = null;
    state.cards = buildDeck(random);
    saveState({ rigLevel: state.rigLevel });
    onChange(state);
  }

  return {
    state,
    flip,
    reset,
    /** Card whose face is intentionally blank right now, or null. */
    get swapping() {
      return swapping;
    },
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Paint one card's two faces and its state attribute.
 *
 * The front canvas is drawn from `card.fruit` at reveal time in a single pass.
 * Task 18 changes when that read happens, not how, which is why nothing here
 * caches the drawn fruit.
 */
function renderCard(element, card, blankFront, flipMs) {
  const previous = element.dataset.state;
  element.dataset.state = card.state;
  const [back, front] = element.querySelectorAll('.card__art');
  drawSprite(back, CARD_BACK);

  // Mid-reveal: the identity is not committed yet, so the face carries no
  // sprite at all. This is what keeps the pre-swap fruit off the screen.
  if (blankFront) {
    clearCanvas(front);
    element.setAttribute('aria-label', `Card ${card.id + 1}`);
    return;
  }

  if (card.state === 'down') {
    element.setAttribute('aria-label', `Card ${card.id + 1}, face down`);
    if (previous && previous !== 'down') {
      // Wipe once the rotation has carried the face out of sight, not at the
      // start of it. Clearing immediately makes the fruit vanish a beat before
      // the card turns away, which is visible on every engine. Never clearing
      // leaves it on screen in WebKit, which paints the front face through the
      // card back despite backface-visibility, and that would expose the board.
      setTimeout(() => {
        if (element.dataset.state === 'down') clearCanvas(front);
      }, flipMs);
    } else {
      clearCanvas(front);
    }
    return;
  }

  drawSprite(front, card.fruit);
  element.setAttribute('aria-label', `Card ${card.id + 1}, ${card.fruit}`);
}

function clearCanvas(canvas) {
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * The scoreboard readouts (SPEC.md §3.3 item 3).
 *
 * A pure function of `matches` over a constant denominator. That is the entire
 * mechanism, and it is why the freeze in SPEC.md §2.6 needs no code: once
 * `matches` stops moving, so does this, with nothing here aware of the rig.
 *
 * Do not add a freeze branch, a rig check, or a high-water cache.
 */
export function formatScoreboard(matches) {
  return {
    score: `SCORE: ${matches}`,
    matches: `MATCHES MADE: ${matches}/${PAIR_COUNT}`,
  };
}

export function renderScoreboard(root, matches) {
  const text = formatScoreboard(matches);
  root.querySelector('[data-readout="score"]').textContent = text.score;
  root.querySelector('[data-readout="matches"]').textContent = text.matches;
}

/** Bind the machine to the existing markup. One listener, delegated. */
export function mount(root, game) {
  const elements = new Map(
    [...root.querySelectorAll('[data-card]')].map((el) => [Number(el.dataset.card), el]),
  );

  const scoreboard = root.ownerDocument.querySelector('[data-region="scoreboard"]');

  const render = () => {
    // Read once per pass rather than once per card: 36 getComputedStyle calls
    // on every render is a measurable cost on a phone.
    const flipMs = readFlipMs();
    for (const card of game.state.cards) {
      const element = elements.get(card.id);
      if (element) renderCard(element, card, card.id === game.swapping, flipMs);
    }
    if (scoreboard) renderScoreboard(scoreboard, game.state.matches);
  };

  root.addEventListener('click', (event) => {
    const element = event.target.closest('[data-card]');
    if (element) game.flip(Number(element.dataset.card));
  });

  render();
  return render;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

/**
 * Debug hook for Playwright, which cannot see through a face-down card.
 *
 * Opt-in via ?fm-test=1 and never present in normal play. A global listing
 * every card's fruit would be a detection channel of its own, and sealing those
 * is the whole point (SPEC.md §1).
 */
function exposeTestHook(game) {
  window.__fmTest = {
    cards: () => game.state.cards.map((card) => ({ ...card })),
    state: () => ({
      first: game.state.first,
      matches: game.state.matches,
      busy: game.state.busy,
      rigLevel: game.state.rigLevel,
      rigged: game.state.rigged,
    }),
  };
}

/**
 * Wire the machine, the markup, and the mute toggle together.
 *
 * `?fm-test=1` enables the debug hook, and only then is `&fm-rig=<n>` honored
 * so a test can hold the rig off and play a full fair board. Both are test
 * affordances behind the same gate, not an escape hatch: nothing in the UI
 * mentions them and normal play cannot reach either (SPEC.md §2.8).
 */
export function startGame(root, { search = '' } = {}) {
  const params = new URLSearchParams(search);
  const testing = params.has('fm-test');
  const rigLevel = testing && params.has('fm-rig') ? Number(params.get('fm-rig')) : undefined;

  let render = () => {};
  const game = createGame({
    onChange: () => render(),
    rigLevel: Number.isFinite(rigLevel) ? rigLevel : loadState().rigLevel,
  });
  render = mount(root, game);

  const resetButton = document.querySelector('[data-control="reset"]');
  if (resetButton) resetButton.addEventListener('click', () => game.reset());

  const mute = document.querySelector('[data-control="mute"]');
  if (mute) {
    const paint = () => {
      mute.setAttribute('aria-pressed', String(isMuted()));
      mute.textContent = isMuted() ? 'Muted' : 'Sound';
    };
    mute.addEventListener('click', () => {
      toggleMute();
      paint();
    });
    paint();
  }

  if (testing) exposeTestHook(game);
  return game;
}

// jsdom unit tests import this module without any markup, so booting is
// conditional on the board actually being on the page.
if (typeof document !== 'undefined') {
  const grid = document.querySelector('[data-region="grid"]');
  if (grid) startGame(grid, { search: window.location.search });
}
