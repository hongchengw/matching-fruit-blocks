import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// SPEC.md §2.2, §2.3, §5 (rigged is derived), §7.1 (the implementation
// constraint), §10.3 (the visual invariant).
//
// This task owns *when* the swap happens. Which fruit the reroll picks is task
// 19, so every test here injects a fixed stub and the two stay separable.

vi.mock('../../js/audio.js', () => ({
  beepFlip: vi.fn(),
  beepMatch: vi.fn(),
  beepMismatch: vi.fn(),
  isMuted: vi.fn(() => false),
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
}));

const { createGame, mount, DEFAULT_FLIP_MS } = await import('../../js/game.js');

function pairedDeck() {
  const fruits = ['apple', 'banana', 'carrot', 'corn', 'tomato', 'pumpkin'];
  return fruits
    .flatMap((fruit) => Array(6).fill(fruit))
    .map((fruit, id) => ({ id, fruit, state: 'down', lastShown: null }));
}

/** Always the same non-matching fruit, so only the timing is under test. */
const stubReroll = () => 'pumpkin';

function riggedGame(options = {}) {
  const game = createGame({ deck: pairedDeck(), reroll: stubReroll, ...options });
  game.state.matches = game.state.rigLevel;
  return game;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the rigged getter (SPEC.md §5)', () => {
  it('is false below the threshold', () => {
    const game = createGame({ deck: pairedDeck(), rigLevel: 5 });
    for (let matches = 0; matches < 5; matches += 1) {
      game.state.matches = matches;
      expect(game.state.rigged).toBe(false);
    }
  });

  it('is true at and above the threshold', () => {
    // Inclusive boundary per SPEC.md §5.
    const game = createGame({ deck: pairedDeck(), rigLevel: 5 });
    for (const matches of [5, 6, 17]) {
      game.state.matches = matches;
      expect(game.state.rigged).toBe(true);
    }
  });

  it('is derived, not stored', () => {
    // A stored flag could drift out of sync with matches and produce an
    // accidentally winnable board.
    const game = createGame({ deck: pairedDeck(), rigLevel: 5 });
    expect(game.state.rigged).toBe(false);
    game.state.matches = 5;
    expect(game.state.rigged).toBe(true);
    game.state.matches = 4;
    expect(game.state.rigged).toBe(false);

    const own = Object.getOwnPropertyDescriptor(game.state, 'rigged');
    expect(own.get).toBeTypeOf('function');
    expect(own.set).toBeUndefined();
    expect(own.value).toBeUndefined();
  });

  it('is true from the first attempt at rigLevel 0', () => {
    // The end state task 21's compounding curse drives toward.
    const game = createGame({ deck: pairedDeck(), rigLevel: 0 });
    expect(game.state.matches).toBe(0);
    expect(game.state.rigged).toBe(true);
  });
});

describe('the reroll scope (SPEC.md §2.4)', () => {
  it('never rerolls the first card', () => {
    const game = riggedGame();
    // Without this the assertion below is vacuous: an unrigged game shows its
    // true first card too.
    expect(game.state.rigged).toBe(true);
    game.flip(0);
    expect(game.state.cards[0].fruit).toBe('apple');
    expect(game.state.cards[0].lastShown).toBe('apple');
  });

  it('holds the first card for the whole attempt', () => {
    const game = riggedGame();
    expect(game.state.rigged).toBe(true);
    game.flip(0);
    game.flip(6);
    vi.advanceTimersByTime(DEFAULT_FLIP_MS);
    // The second card moved, so the first card standing still is meaningful.
    expect(game.state.cards[6].fruit).toBe('pumpkin');
    expect(game.state.cards[0].fruit).toBe('apple');

    // Still holding right up to the end of the attempt. Past that boundary the
    // card is face down and task 20's reshuffle owns every unmatched identity,
    // so asserting beyond here would be asserting the wrong thing.
    vi.advanceTimersByTime(999 - DEFAULT_FLIP_MS);
    expect(game.state.cards[0].fruit).toBe('apple');
    expect(game.state.cards[0].state).toBe('up');
  });

  it('rerolls the second card only when rigged', () => {
    const honest = createGame({ deck: pairedDeck(), reroll: stubReroll });
    honest.flip(0);
    honest.flip(6);
    vi.advanceTimersByTime(DEFAULT_FLIP_MS);
    expect(honest.state.cards[6].fruit).toBe('banana');

    const game = riggedGame();
    game.flip(0);
    game.flip(6);
    vi.advanceTimersByTime(DEFAULT_FLIP_MS);
    expect(game.state.cards[6].fruit).toBe('pumpkin');
    expect(game.state.cards[6].lastShown).toBe('pumpkin');
  });

  it('never lets a rigged attempt on a non-pair match', () => {
    // This asserted that *no* rigged attempt could ever match. SPEC.md §7.4
    // changed that deliberately: a permanent rate of exactly zero was itself
    // proof the game was rigged, to anyone counting. What survives, and what
    // the reroll actually guarantees, is that an attempt on two cards that are
    // not a genuine pair can never land, because exclusion 1 is never dropped.
    const game = riggedGame();
    const cards = game.state.cards;
    const first = cards[0];
    const second = cards.find((card) => card.fruit !== first.fruit);

    game.flip(first.id);
    game.flip(second.id);
    vi.advanceTimersByTime(DEFAULT_FLIP_MS + 1000);
    expect(game.state.matches).toBe(game.state.rigLevel);
    expect(second.state).toBe('down');
  });
});

describe('the midpoint swap (SPEC.md §7.1)', () => {
  it('schedules the swap against half the flip duration', () => {
    // Derived from the duration, never hardcoded as 90. A tuned flip, or the
    // shortened reduced-motion flip, must move the midpoint with it.
    //
    // The midpoint is a ceiling rather than a target (SPEC.md §7.1): the swap
    // lands within a frame before it and never after, since the face is
    // invisible until 90deg but turning toward the player after it.
    const game = riggedGame({ flipMs: 240 });
    game.flip(0);
    game.flip(6);

    vi.advanceTimersByTime(85);
    expect(game.state.cards[6].fruit, 'swapped more than a frame early').toBe('banana');
    vi.advanceTimersByTime(120 - 85);
    expect(game.state.cards[6].fruit, 'had not swapped by the midpoint').toBe('pumpkin');
  });

  it('defaults the flip duration to the value CSS publishes', () => {
    expect(DEFAULT_FLIP_MS).toBe(180);
    const game = riggedGame();
    game.flip(0);
    game.flip(6);
    vi.advanceTimersByTime(55);
    expect(game.state.cards[6].fruit, 'swapped more than a frame early').toBe('banana');
    vi.advanceTimersByTime(90 - 55);
    expect(game.state.cards[6].fruit, 'had not swapped by the midpoint').toBe('pumpkin');
  });

  it('never paints the pre-swap fruit', () => {
    // The identity is decided and drawn once, at the midpoint. Drawing the true
    // fruit and replacing it is what would produce a visible pre-swap frame.
    const game = riggedGame();
    game.flip(0);
    game.flip(6);
    expect(game.state.cards[6].fruit).toBe('banana');
    expect(game.swapping).toBe(6);
    vi.advanceTimersByTime(DEFAULT_FLIP_MS / 2);
    expect(game.swapping).toBeNull();
  });

  it('registers no transitionend listener', () => {
    // SPEC.md §7.1 forbids it: transitionend fires once the card is face-on
    // again, which guarantees a visible pre-swap frame.
    document.body.innerHTML = `<div data-region="grid">${Array.from(
      { length: 36 },
      (_, id) =>
        `<button data-card="${id}" data-state="down"><span class="card__inner">` +
        '<span class="card__face card__face--back"><canvas class="card__art"></canvas></span>' +
        '<span class="card__face card__face--front"><canvas class="card__art"></canvas></span>' +
        '</span></button>',
    ).join('')}</div>`;

    // jsdom has no canvas backend, so give the renderer somewhere to paint.
    const noop = () => {};
    for (const canvas of document.querySelectorAll('canvas')) {
      canvas.getContext = () => ({ clearRect: noop, fillRect: noop, set fillStyle(_) {} });
    }

    const root = document.querySelector('[data-region="grid"]');
    const game = riggedGame();
    mount(root, game);

    const listeners = [];
    for (const el of document.querySelectorAll('[data-card], .card__inner')) {
      const original = el.addEventListener.bind(el);
      el.addEventListener = (type, ...rest) => {
        listeners.push(type);
        return original(type, ...rest);
      };
    }

    game.flip(0);
    game.flip(6);
    vi.advanceTimersByTime(DEFAULT_FLIP_MS + 1000);
    expect(listeners).not.toContain('transitionend');
  });

  it('schedules on a midpoint timer and not on transitionend', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(resolve(process.cwd(), 'js/game.js'), 'utf8');
    // Both halves. Asserting only the absence would pass against a file that
    // has no swap in it at all.
    expect(source).toMatch(/flipMidpoint/);
    expect(source).not.toMatch(/transitionend/);
  });
});

describe('rigged timing is honest timing', () => {
  it('uses the same 1000ms flip-back and the same mismatch cue', async () => {
    const audio = await import('../../js/audio.js');

    const honest = createGame({ deck: pairedDeck(), reroll: stubReroll });
    honest.flip(0);
    honest.flip(6);
    expect(audio.beepMismatch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(999);
    expect(honest.state.cards[0].state).toBe('up');
    vi.advanceTimersByTime(1);
    expect(honest.state.cards[0].state).toBe('down');

    vi.clearAllMocks();

    const game = riggedGame();
    expect(game.state.rigged).toBe(true);
    game.flip(0);
    game.flip(6);
    // The cue fires at the same moment in the attempt, not after the swap.
    expect(audio.beepMismatch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(999);
    expect(game.state.cards[0].state).toBe('up');
    // The swap really did happen inside that window, so the comparison above
    // is between an honest attempt and a genuinely rigged one.
    expect(game.state.cards[6].fruit).toBe('pumpkin');
    vi.advanceTimersByTime(1);
    expect(game.state.cards[0].state).toBe('down');
  });
});
