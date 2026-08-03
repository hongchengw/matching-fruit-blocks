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

/**
 * The game as a small state machine over SPEC.md §5.
 *
 * `onChange` is the only way out: the caller renders, the machine never touches
 * the DOM. That keeps the loop testable under jsdom with no markup at all.
 */
export function createGame({ deck = buildDeck(), onChange = () => {} } = {}) {
  const state = {
    cards: deck,
    first: null,
    matches: 0,
    busy: false,
  };

  const cardAt = (id) => state.cards.find((card) => card.id === id);

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

  function resolveMismatch(first, second) {
    beepMismatch();
    setTimeout(() => {
      first.state = 'down';
      second.state = 'down';
      state.first = null;
      // Task 20 reshuffles here, after both cards are face down and before the
      // lock is released, so no frame shows the board changing.
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
    reveal(card);

    if (first.fruit === card.fruit) {
      resolveMatch(first, card);
    } else {
      resolveMismatch(first, card);
    }

    onChange(state);
    return true;
  }

  return { state, flip };
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
function renderCard(element, card) {
  element.dataset.state = card.state;
  const [back, front] = element.querySelectorAll('.card__art');
  drawSprite(back, CARD_BACK);
  if (card.state === 'down') {
    element.setAttribute('aria-label', `Card ${card.id + 1}, face down`);
    return;
  }
  drawSprite(front, card.fruit);
  element.setAttribute('aria-label', `Card ${card.id + 1}, ${card.fruit}`);
}

/** Bind the machine to the existing markup. One listener, delegated. */
export function mount(root, game) {
  const elements = new Map(
    [...root.querySelectorAll('[data-card]')].map((el) => [Number(el.dataset.card), el]),
  );

  const render = () => {
    for (const card of game.state.cards) {
      const element = elements.get(card.id);
      if (element) renderCard(element, card);
    }
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
    state: () => ({ first: game.state.first, matches: game.state.matches, busy: game.state.busy }),
  };
}

/** Wire the machine, the markup, and the mute toggle together. */
export function startGame(root, { search = '' } = {}) {
  let render = () => {};
  const game = createGame({ onChange: () => render() });
  render = mount(root, game);

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

  if (new URLSearchParams(search).has('fm-test')) exposeTestHook(game);
  return game;
}

// jsdom unit tests import this module without any markup, so booting is
// conditional on the board actually being on the page.
if (typeof document !== 'undefined') {
  const grid = document.querySelector('[data-region="grid"]');
  if (grid) startGame(grid, { search: window.location.search });
}
