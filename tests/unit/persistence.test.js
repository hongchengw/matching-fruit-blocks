import { describe, it, expect, beforeEach, vi } from 'vitest';

// SPEC.md §2.7, §2.8 (rationale) and §8 (the persistence spec in full).
//
// Each reset shortens the honest phase. The player's natural response to being
// stuck is to start over, and starting over is what makes it worse.

vi.mock('../../js/audio.js', () => ({
  beepFlip: vi.fn(),
  beepMatch: vi.fn(),
  beepMismatch: vi.fn(),
  isMuted: vi.fn(() => false),
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
}));

const { loadState, saveState, createGame, buildDeck, STORAGE_KEY, DEFAULT_RIG_LEVEL } =
  await import('../../js/game.js');

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('loading', () => {
  it('defaults to rigLevel 5 and unmuted on a fresh browser', () => {
    expect(loadState()).toEqual({ rigLevel: 5, muted: false });
    expect(DEFAULT_RIG_LEVEL).toBe(5);
  });

  it('writes the documented shape', () => {
    saveState({ rigLevel: 3 });
    expect(Object.keys(stored()).sort()).toEqual(['muted', 'rigLevel']);
    expect(stored().rigLevel).toBe(3);
  });

  it('recovers from a corrupt value', () => {
    // A crash on load would be a very loud tell.
    localStorage.setItem(STORAGE_KEY, '{not json at all');
    expect(loadState()).toEqual({ rigLevel: 5, muted: false });
    expect(stored()).toEqual({ rigLevel: 5, muted: false });
  });

  it('recovers from out-of-range values', () => {
    for (const value of [-3, 999, '4', null, Number.NaN, {}]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ rigLevel: value, muted: false }));
      const { rigLevel } = loadState();
      expect(Number.isInteger(rigLevel)).toBe(true);
      expect(rigLevel).toBeGreaterThanOrEqual(0);
      expect(rigLevel).toBeLessThanOrEqual(DEFAULT_RIG_LEVEL);
    }
  });

  it('persists no board state', () => {
    // A reload starts a fresh board at the stored rigLevel (SPEC.md §8).
    saveState({ rigLevel: 2 });
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toMatch(/cards|fruit|apple|lastShown/);
  });

  it('degrades to memory when storage throws', () => {
    // Private browsing can throw on access. The game must not crash.
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('quota');
    };
    expect(() => saveState({ rigLevel: 1 })).not.toThrow();
    Storage.prototype.setItem = original;
  });
});

describe('reset', () => {
  it('decrements rigLevel by one', () => {
    const game = createGame({ deck: buildDeck(), rigLevel: 5 });
    game.reset();
    expect(game.state.rigLevel).toBe(4);
    game.reset();
    expect(game.state.rigLevel).toBe(3);
    expect(loadState().rigLevel).toBe(3);
  });

  it('floors at zero', () => {
    // A negative threshold would still satisfy matches >= rigLevel, but the
    // floor keeps the state readable and the intent explicit.
    const game = createGame({ deck: buildDeck(), rigLevel: 1 });
    game.reset();
    game.reset();
    game.reset();
    expect(game.state.rigLevel).toBe(0);
    expect(loadState().rigLevel).toBe(0);
  });

  it('clears matches and deals a new board', () => {
    const deck = ['apple', 'apple']
      .concat(Array(34).fill('corn'))
      .map((fruit, id) => ({ id, fruit, state: 'down', lastShown: null }));
    const game = createGame({ deck, rigLevel: 5 });
    game.flip(0);
    game.flip(1);
    expect(game.state.matches).toBe(1);

    const before = game.state.cards.map((card) => card.fruit).join();
    game.reset();

    expect(game.state.matches).toBe(0);
    expect(game.state.first).toBeNull();
    expect(game.state.busy).toBe(false);
    expect(game.state.cards.every((card) => card.state === 'down')).toBe(true);
    expect(game.state.cards.map((card) => card.fruit).join()).not.toBe(before);
  });

  it('does not clobber the mute setting', () => {
    // Both keys share fm.state with task 14.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rigLevel: 5, muted: true }));
    const game = createGame({ deck: buildDeck(), rigLevel: 5 });
    game.reset();
    expect(stored().muted).toBe(true);
    expect(stored().rigLevel).toBe(4);
  });

  it('arms the rig immediately once rigLevel reaches 0', () => {
    const game = createGame({ deck: buildDeck(), rigLevel: 1 });
    game.reset();
    expect(game.state.rigLevel).toBe(0);
    expect(game.state.matches).toBe(0);
    expect(game.state.rigged).toBe(true);
  });
});
