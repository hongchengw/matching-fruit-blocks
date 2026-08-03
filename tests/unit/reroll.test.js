import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// SPEC.md §2.11 (rationale) and §7.2 (the algorithm in full).
//
// This is the most consequential function in the codebase. Exclusion 1 is what
// makes the game unwinnable; exclusion 2 is what stops the card from
// contradicting itself in front of the player.

vi.mock('../../js/audio.js', () => ({
  beepFlip: vi.fn(),
  beepMatch: vi.fn(),
  beepMismatch: vi.fn(),
  isMuted: vi.fn(() => false),
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
}));

const { rerollFruit, createGame, FRUITS, DEFAULT_FLIP_MS } = await import('../../js/game.js');
const { SPRITES } = await import('../../js/sprites.js');

const card = (overrides = {}) => ({ id: 1, fruit: 'apple', state: 'up', lastShown: null, ...overrides });

/** Every fruit in play, so the preference never narrows the pool by itself. */
const allInPlay = Object.fromEntries(FRUITS.map((fruit) => [fruit, 4]));

describe('rerollFruit', () => {
  it('returns one of the six fruits', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(FRUITS).toContain(rerollFruit(card(), card({ fruit: 'corn' }), allInPlay));
    }
  });

  it('never returns the first card of the attempt', () => {
    // Exclusion 1, hard. This single rule is the rig.
    for (const fruit of FRUITS) {
      for (let i = 0; i < 200; i += 1) {
        expect(rerollFruit(card(), card({ fruit }), allInPlay)).not.toBe(fruit);
      }
    }
  });

  it('never returns the fruit the card just showed', () => {
    // Exclusion 2, soft. A card that showed banana a moment ago, shows banana
    // again, and still refuses to match is a visible self-contradiction.
    for (let i = 0; i < 300; i += 1) {
      const result = rerollFruit(card({ lastShown: 'banana' }), card({ fruit: 'corn' }), allInPlay);
      expect(result).not.toBe('banana');
      expect(result).not.toBe('corn');
    }
  });

  it('prefers fruits still in play', () => {
    // The board must never display produce that should not be there.
    const counts = { apple: 0, banana: 0, carrot: 6, corn: 4, tomato: 2, pumpkin: 0 };
    const results = Array.from({ length: 300 }, () =>
      rerollFruit(card({ lastShown: null }), card({ fruit: 'apple' }), counts),
    );
    expect(results.every((fruit) => counts[fruit] > 0)).toBe(true);
  });

  it('drops exclusion 2 in the fallback, never exclusion 1', () => {
    // A two-fruit universe is the only way to empty the candidate set, so it is
    // how the fallback branch is reached at all.
    const universe = ['apple', 'banana'];
    for (let i = 0; i < 100; i += 1) {
      const result = rerollFruit(
        card({ lastShown: 'banana' }),
        card({ fruit: 'apple' }),
        { apple: 2, banana: 2 },
        Math.random,
        universe,
      );
      // May now equal lastShown, which proves the fallback ran.
      expect(result).toBe('banana');
      expect(result).not.toBe('apple');
    }
  });

  it('keeps the in-play preference from emptying the pool', () => {
    // The preference is a preference, not a filter. With nothing in play it is
    // ignored rather than falling through to exclusion 1.
    const counts = Object.fromEntries(FRUITS.map((fruit) => [fruit, 0]));
    for (let i = 0; i < 100; i += 1) {
      const result = rerollFruit(card(), card({ fruit: 'corn' }), counts);
      expect(FRUITS).toContain(result);
      expect(result).not.toBe('corn');
    }
  });

  it('is not degenerate', () => {
    // A reroll that always returned banana would be noticeable within a handful
    // of attempts.
    const results = Array.from({ length: 600 }, () =>
      rerollFruit(card({ lastShown: null }), card({ fruit: 'apple' }), allInPlay),
    );
    const counts = {};
    for (const fruit of results) counts[fruit] = (counts[fruit] ?? 0) + 1;

    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(3);
    // Five candidates remain after exclusion 1, so no fruit should take more
    // than double its fair share.
    expect(Math.max(...Object.values(counts)) / results.length).toBeLessThan(0.4);
  });

  it('accepts an injected random source', () => {
    const first = rerollFruit(card(), card({ fruit: 'apple' }), allInPlay, () => 0);
    const again = rerollFruit(card(), card({ fruit: 'apple' }), allInPlay, () => 0);
    expect(first).toBe(again);
  });

  it('only ever returns a registered sprite name', () => {
    // An unregistered name would throw inside drawSprite mid-flip and blank the
    // card at the worst possible moment.
    for (let i = 0; i < 200; i += 1) {
      expect(SPRITES).toHaveProperty(rerollFruit(card(), card({ fruit: 'tomato' }), allInPlay));
    }
  });
});

describe('the reroll in the loop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function riggedGame() {
    const deck = ['apple', 'banana', 'carrot', 'corn', 'tomato', 'pumpkin']
      .flatMap((fruit) => Array(6).fill(fruit))
      .map((fruit, id) => ({ id, fruit, state: 'down', lastShown: null }));
    const game = createGame({ deck, rigLevel: 0 });
    return game;
  }

  it('commits the rerolled value to the card', () => {
    const game = riggedGame();
    game.flip(0);
    game.flip(6);
    vi.advanceTimersByTime(DEFAULT_FLIP_MS);
    expect(game.state.cards[6].fruit).not.toBe('banana');
    expect(game.state.cards[6].fruit).not.toBe('apple');
    expect(FRUITS).toContain(game.state.cards[6].fruit);
  });

  it('updates lastShown, and honors it on the next reroll of that card', () => {
    const game = riggedGame();
    const target = game.state.cards[6];

    game.flip(0);
    game.flip(6);
    vi.advanceTimersByTime(DEFAULT_FLIP_MS);
    expect(target.lastShown).toBe(target.fruit);
    const shown = target.lastShown;
    vi.advanceTimersByTime(1000);

    // Same card, same first card, so a reroll that ignored lastShown would land
    // on the same fruit again and contradict itself in front of the player.
    game.flip(0);
    game.flip(6);
    vi.advanceTimersByTime(DEFAULT_FLIP_MS);
    expect(target.fruit).not.toBe(shown);
  });

  it('never matches, and never repeats itself, over a long rigged run', () => {
    const game = riggedGame();
    const seen = new Set();
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const down = game.state.cards.filter((c) => c.state === 'down');
      const first = down[0];
      const second = down.find((c) => c.id !== first.id);
      const before = second.lastShown;

      game.flip(first.id);
      game.flip(second.id);
      vi.advanceTimersByTime(DEFAULT_FLIP_MS);

      expect(second.fruit).not.toBe(first.fruit);
      if (before) expect(second.fruit).not.toBe(before);
      seen.add(second.fruit);
      vi.advanceTimersByTime(1000);
    }
    expect(game.state.matches).toBe(0);
    // A rig that always showed the same fruit would be spotted immediately.
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});
