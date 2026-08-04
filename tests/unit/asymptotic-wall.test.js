import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// SPEC.md §7.4 and the statistical channel in §10.3.
//
// The rigged match rate used to be exactly zero, permanently and by
// construction. Real memory failure is noisy and noise produces occasional
// hits, so a flawless zero is a signature: proof by inference, without the
// player ever catching a sprite changing.

vi.mock('../../js/audio.js', () => ({
  beepFlip: vi.fn(),
  beepMatch: vi.fn(),
  beepMismatch: vi.fn(),
  isMuted: vi.fn(() => false),
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
}));

const { createGame, buildDeck, matchGrantChance, PAIR_COUNT, DEFAULT_FLIP_MS } = await import(
  '../../js/game.js'
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

const unmatched = (game) => game.state.cards.filter((c) => c.state !== 'locked');
const outstandingPairs = (game) => unmatched(game).length / 2;

function counts(game) {
  return unmatched(game).reduce((acc, card) => {
    acc[card.fruit] = (acc[card.fruit] ?? 0) + 1;
    return acc;
  }, {});
}

const everyCountEven = (game) => Object.values(counts(game)).every((n) => n % 2 === 0);

/** A true pair among face-down cards, or null. */
function truePair(game) {
  const down = game.state.cards.filter((c) => c.state === 'down');
  for (let i = 0; i < down.length; i += 1) {
    for (let j = i + 1; j < down.length; j += 1) {
      if (down[i].fruit === down[j].fruit) return [down[i], down[j]];
    }
  }
  return null;
}

/** One full attempt on a true pair, resolved either way. */
function attemptTruePair(game) {
  const pair = truePair(game);
  if (!pair) return false;
  game.flip(pair[0].id);
  game.flip(pair[1].id);
  vi.advanceTimersByTime(DEFAULT_FLIP_MS);
  vi.advanceTimersByTime(1000);
  return true;
}

describe('matchGrantChance', () => {
  it('is exactly zero for the last pair', () => {
    // Absolute, not probabilistic. This is what keeps the game unwinnable.
    expect(matchGrantChance(1)).toBe(0);
    expect(matchGrantChance(0)).toBe(0);
  });

  it('is nonzero while more than one pair is outstanding', () => {
    for (let pairs = 2; pairs <= PAIR_COUNT; pairs += 1) {
      expect(matchGrantChance(pairs), `${pairs} pairs outstanding`).toBeGreaterThan(0);
    }
  });

  it('decays as the board empties', () => {
    expect(matchGrantChance(13)).toBeGreaterThan(matchGrantChance(6));
    expect(matchGrantChance(6)).toBeGreaterThan(matchGrantChance(2));
  });

  it('stays well below an honest rate', () => {
    // The player must feel unlucky, never helped.
    for (let pairs = 2; pairs <= PAIR_COUNT; pairs += 1) {
      expect(matchGrantChance(pairs), `${pairs} pairs outstanding`).toBeLessThan(0.35);
    }
  });

  it('is a pure function of the pair count', () => {
    for (let pairs = 0; pairs <= PAIR_COUNT; pairs += 1) {
      expect(matchGrantChance(pairs)).toBe(matchGrantChance(pairs));
    }
  });
});

describe('the asymptotic wall', () => {
  it('never lets the board empty', () => {
    // The floor, driven hard: always take the grant when one is offered.
    const game = createGame({ deck: buildDeck(), rigLevel: 0, random: () => 0 });
    for (let i = 0; i < 400; i += 1) {
      if (!attemptTruePair(game)) break;
      expect(outstandingPairs(game), `board emptied on attempt ${i + 1}`).toBeGreaterThan(0);
    }
    expect(outstandingPairs(game)).toBeGreaterThanOrEqual(1);
    expect(game.state.matches).toBeLessThan(PAIR_COUNT);
  });

  it('stalls at one outstanding pair forever', () => {
    const game = createGame({ deck: buildDeck(), rigLevel: 0, random: () => 0 });
    for (let i = 0; i < 400; i += 1) if (!attemptTruePair(game)) break;
    expect(outstandingPairs(game)).toBe(1);

    // And it stays there, however long the player keeps trying.
    for (let i = 0; i < 100; i += 1) attemptTruePair(game);
    expect(outstandingPairs(game)).toBe(1);
    expect(game.state.matches).toBe(PAIR_COUNT - 1);
  });

  it('grants at least one match over a long rigged run', () => {
    // The channel this task exists to seal. Fails today: the rate is zero.
    const game = createGame({ deck: buildDeck(), rigLevel: 0 });
    const before = game.state.matches;
    for (let i = 0; i < 200; i += 1) attemptTruePair(game);
    expect(game.state.matches, 'not one match in 200 rigged attempts').toBeGreaterThan(before);
  });

  it('never grants a match on cards that are not a true pair', () => {
    // The grant rewards a real find. It never invents one, which is what keeps
    // the tally invariant intact (SPEC.md §7.4).
    const game = createGame({ deck: buildDeck(), rigLevel: 0, random: () => 0 });
    for (let i = 0; i < 60; i += 1) {
      const down = game.state.cards.filter((c) => c.state === 'down');
      const first = down[0];
      const other = down.find((c) => c.fruit !== first.fruit);
      if (!other) break;
      game.flip(first.id);
      game.flip(other.id);
      vi.advanceTimersByTime(DEFAULT_FLIP_MS);
      vi.advanceTimersByTime(1000);
      expect(game.state.matches, `a mismatch was granted on attempt ${i + 1}`).toBe(0);
    }
  });

  it('keeps every unmatched fruit count even across the wall', () => {
    const game = createGame({ deck: buildDeck(), rigLevel: 0, random: () => 0 });
    for (let i = 0; i < 200; i += 1) {
      if (!attemptTruePair(game)) break;
      expect(everyCountEven(game), `odd count after attempt ${i + 1}`).toBe(true);
    }
  });

  it('does not reroll on a granted match', () => {
    // A granted match is an honest match in every respect. If the second card's
    // identity moved, it was not the pair the player found.
    const game = createGame({ deck: buildDeck(), rigLevel: 0, random: () => 0 });
    const pair = truePair(game);
    const fruit = pair[0].fruit;
    game.flip(pair[0].id);
    game.flip(pair[1].id);
    vi.advanceTimersByTime(DEFAULT_FLIP_MS);

    expect(game.state.matches).toBe(1);
    expect(pair[0].fruit).toBe(fruit);
    expect(pair[1].fruit).toBe(fruit);
    expect(pair[0].state).toBe('locked');
    expect(pair[1].state).toBe('locked');
  });

  it('leaves the honest phase alone', () => {
    // The grant only exists inside the rigged phase. Honest play is unchanged.
    const game = createGame({ deck: buildDeck(), rigLevel: 5 });
    expect(game.state.rigged).toBe(false);
    attemptTruePair(game);
    expect(game.state.matches).toBe(1);
  });
});
