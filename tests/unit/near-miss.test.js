import { describe, it, expect, vi } from 'vitest';

// SPEC.md §7.2 preference 1. The rig shows the player a fruit they have just
// seen somewhere else, so they think they know where the twin is and go to get
// it. They are wrong, and they blame themselves.

vi.mock('../../js/audio.js', () => ({
  beepFlip: vi.fn(),
  beepMatch: vi.fn(),
  beepMismatch: vi.fn(),
  isMuted: vi.fn(() => false),
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
}));

const { rerollFruit, FRUITS } = await import('../../js/game.js');

const card = (lastShown = null) => ({ id: 1, fruit: 'apple', lastShown });
const first = (fruit) => ({ id: 0, fruit });

/** Distribution of `rerollFruit` over many draws. */
function distribution(options, draws = 3000) {
  const seen = {};
  for (let i = 0; i < draws; i += 1) {
    const fruit = rerollFruit(
      options.card ?? card(),
      options.first ?? first('apple'),
      options.counts ?? {},
      Math.random,
      options.fruits ?? FRUITS,
      options.recent ?? [],
    );
    seen[fruit] = (seen[fruit] ?? 0) + 1;
  }
  return seen;
}

describe('the recency preference', () => {
  it('prefers a fruit the player has recently seen', () => {
    const seen = distribution({ recent: ['corn'] });
    const corn = seen.corn ?? 0;
    const others = Object.entries(seen)
      .filter(([fruit]) => fruit !== 'corn')
      .reduce((a, [, n]) => a + n, 0);
    expect(corn, 'the reroll ignored the reveal history').toBeGreaterThan(others);
  });

  it('never returns the first card\'s fruit, however hard the history pushes', () => {
    // Adversarial: a history made of nothing but the one fruit that must never
    // come back. If a preference can override exclusion 1 the game becomes
    // winnable by accident and the rig stops being a rig.
    const seen = distribution({
      first: first('banana'),
      recent: Array(50).fill('banana'),
    });
    expect(seen.banana, 'the rig returned the first card\'s fruit').toBeUndefined();
  });

  it('still honours the lastShown exclusion', () => {
    // A card showing corn, refusing to match, then showing corn again is a
    // contradiction the player can see. History must not buy past it.
    const seen = distribution({
      card: card('corn'),
      recent: Array(50).fill('corn'),
    });
    expect(seen.corn).toBeUndefined();
  });

  it('falls back cleanly when the history is empty', () => {
    const seen = distribution({ recent: [] });
    expect(Object.keys(seen).length).toBeGreaterThan(1);
    expect(seen.apple).toBeUndefined();
  });

  it('falls back cleanly when the history holds only excluded fruits', () => {
    const seen = distribution({
      card: card('corn'),
      first: first('apple'),
      recent: ['apple', 'corn', 'apple', 'corn'],
    });
    expect(Object.keys(seen).length).toBeGreaterThan(1);
    expect(seen.apple).toBeUndefined();
    expect(seen.corn).toBeUndefined();
  });

  it('is not degenerate', () => {
    // A rig that always showed the same fruit would be spotted in a minute,
    // even one the player recently saw.
    const seen = distribution({ recent: ['corn', 'tomato', 'pumpkin'] });
    expect(Object.keys(seen).length).toBeGreaterThanOrEqual(3);
  });

  it('leaves the in-play preference in force beneath it', () => {
    // With no history, §7.2's original preference still governs.
    const seen = distribution({ counts: { banana: 4, carrot: 0, corn: 0, tomato: 0, pumpkin: 0 } });
    expect(seen.banana).toBeGreaterThan(0);
    expect(Object.keys(seen)).toEqual(['banana']);
  });

  it('stays pure', () => {
    // No game state, no globals, no reads of anything but its arguments.
    const target = card('corn');
    const before = JSON.stringify(target);
    rerollFruit(target, first('apple'), {}, Math.random, FRUITS, ['banana']);
    expect(JSON.stringify(target)).toBe(before);
  });
});
