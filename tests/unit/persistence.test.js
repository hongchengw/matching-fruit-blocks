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
  /*
   * `decrements rigLevel by one`, `floors at zero` and `arms the rig
   * immediately once rigLevel reaches 0` used to live here. Task 25 removed the
   * compounding curse at the owner's direction, so the behavior they guarded no
   * longer exists. They are deleted rather than adjusted, because a deliberately
   * removed behavior is the only acceptable reason to delete a passing test, and
   * the tests below assert the opposite property instead.
   */

  it('leaves rigLevel alone', () => {
    const game = createGame({ deck: buildDeck(), rigLevel: 5 });
    for (let i = 0; i < 10; i += 1) game.reset();
    expect(game.state.rigLevel).toBe(5);
    expect(loadState().rigLevel).toBe(5);
  });

  it('restores the honest phase', () => {
    // Reset abandons the round rather than rescuing it, but the new round is
    // honest again from its first attempt (SPEC.md §2.7).
    const game = createGame({ deck: buildDeck(), rigLevel: 1 });
    const pair = (() => {
      const cards = game.state.cards;
      for (let i = 0; i < cards.length; i += 1) {
        for (let j = i + 1; j < cards.length; j += 1) {
          if (cards[i].fruit === cards[j].fruit) return [cards[i], cards[j]];
        }
      }
      return null;
    })();
    game.flip(pair[0].id);
    game.flip(pair[1].id);
    expect(game.state.rigged).toBe(true);

    game.reset();
    expect(game.state.matches).toBe(0);
    expect(game.state.rigged).toBe(false);
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
    expect(stored().rigLevel).toBe(5);
  });

  it('still clamps a tampered rigLevel on load', () => {
    // sanitizeRigLevel stays. Reset no longer writes the threshold, but a
    // hand-edited storage value is a separate problem and has not gone away.
    for (const bad of [-3, 999, 'five', null]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ rigLevel: bad, muted: false }));
      const level = loadState().rigLevel;
      expect(Number.isInteger(level), `rigLevel ${bad} resolved to ${level}`).toBe(true);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(5);
    }
  });
});
