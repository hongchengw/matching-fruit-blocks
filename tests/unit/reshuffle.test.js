import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// SPEC.md §2.5, §2.12 (rationale), §7.3 (the algorithm), §10.3 (the tally
// invariant).
//
// The reroll in task 19 mutates one card's fruit, turning six apples into five
// and seven bananas into eight. Odd counts make the board provably unsolvable
// to anyone who flips around and tallies. Regenerating the multiset from the
// outstanding pair count repairs that every time; permuting the current values
// faithfully preserves it.

vi.mock('../../js/audio.js', () => ({
  beepFlip: vi.fn(),
  beepMatch: vi.fn(),
  beepMismatch: vi.fn(),
  isMuted: vi.fn(() => false),
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
}));

const { createGame, silentReshuffle, buildDeck, FRUITS, PAIR_COUNT, DEFAULT_FLIP_MS } =
  await import('../../js/game.js');

const unmatched = (cards) => cards.filter((card) => card.state !== 'locked');

function counts(cards) {
  return unmatched(cards).reduce((acc, card) => {
    acc[card.fruit] = (acc[card.fruit] ?? 0) + 1;
    return acc;
  }, {});
}

const everyCountEven = (cards) => Object.values(counts(cards)).every((n) => n % 2 === 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

/** A rigged game whose every attempt fails, which is the interesting case. */
function riggedGame() {
  return createGame({ deck: buildDeck(), rigLevel: 0 });
}

/** One complete failed attempt, ending with the board face down again. */
function failOnce(game) {
  const down = game.state.cards.filter((card) => card.state === 'down');
  game.flip(down[0].id);
  game.flip(down[1].id);
  vi.advanceTimersByTime(DEFAULT_FLIP_MS);
  vi.advanceTimersByTime(1000);
}

describe('silentReshuffle', () => {
  it('runs after a failed attempt and never after a match', () => {
    const game = createGame({
      deck: ['apple', 'apple', 'banana', 'banana']
        .concat(Array(32).fill('corn'))
        .map((fruit, id) => ({ id, fruit, state: 'down', lastShown: null })),
      rigLevel: 999,
    });

    // A match leaves the rest of the board untouched.
    const before = game.state.cards.map((card) => card.fruit).join();
    game.flip(0);
    game.flip(1);
    expect(game.state.cards.map((card) => card.fruit).join()).toBe(before);

    // A failure rearranges it.
    game.flip(2);
    game.flip(4);
    vi.advanceTimersByTime(1000);
    expect(game.state.cards.map((card) => card.fruit).join()).not.toBe(before);
  });

  it('never touches locked cards', () => {
    const game = createGame({ deck: buildDeck(), rigLevel: 999 });
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
    const lockedFruit = pair[0].fruit;

    for (let i = 0; i < 20; i += 1) silentReshuffle(game.state.cards, game.state.matches);

    expect(pair[0].state).toBe('locked');
    expect(pair[0].fruit).toBe(lockedFruit);
    expect(pair[1].fruit).toBe(lockedFruit);
  });

  it('preserves the card count and the ids', () => {
    const cards = buildDeck();
    silentReshuffle(cards, 0);
    expect(cards).toHaveLength(36);
    expect(cards.map((card) => card.id)).toEqual([...Array(36).keys()]);
  });

  it('leaves every unmatched fruit count even', () => {
    // The tally invariant from SPEC.md §10.3, base case.
    const cards = buildDeck();
    silentReshuffle(cards, 0);
    expect(everyCountEven(cards)).toBe(true);
  });

  it('keeps counts even across arbitrary reroll and reshuffle sequences', () => {
    // The test this whole task exists for.
    const game = riggedGame();
    for (let cycle = 0; cycle < 200; cycle += 1) {
      failOnce(game);
      expect(everyCountEven(game.state.cards), `cycle ${cycle}`).toBe(true);
    }
  });

  it('regenerates rather than permutes', () => {
    // Corrupt the board into a state no permutation could repair. This is what
    // separates the correct implementation from the obvious wrong one.
    const cards = buildDeck();
    cards.forEach((card, i) => {
      card.fruit = i < 5 ? 'apple' : i < 12 ? 'banana' : 'corn';
    });
    expect(counts(cards).apple % 2).toBe(1);
    expect(counts(cards).banana % 2).toBe(1);

    silentReshuffle(cards, 0);
    expect(everyCountEven(cards)).toBe(true);
  });

  it('drives the multiset from the outstanding pair count', () => {
    const cards = buildDeck();
    for (let i = 0; i < 10; i += 1) cards[i].state = 'locked';
    silentReshuffle(cards, 5);

    const total = unmatched(cards).length;
    expect(total).toBe(2 * (PAIR_COUNT - 5));
    expect(total).toBe(26);
  });

  it('distributes across all six fruits', () => {
    // A board that collapsed onto one or two fruits would not be plausible.
    const cards = buildDeck();
    silentReshuffle(cards, 0);
    expect(Object.keys(counts(cards)).length).toBe(FRUITS.length);
  });

  it('always leaves a board that looks solvable', () => {
    // The direct statement of the illusion SPEC.md §2.12 protects: every
    // unmatched card could in principle be paired off.
    const game = riggedGame();
    for (let cycle = 0; cycle < 50; cycle += 1) {
      failOnce(game);
      // Solvable means every fruit pairs off on its own. Summing halves across
      // fruits always lands on a whole number even when the counts are odd, so
      // the check has to be per fruit.
      const tally = counts(game.state.cards);
      for (const [fruit, n] of Object.entries(tally)) {
        expect(Number.isInteger(n / 2), `${fruit} count ${n} cannot pair off`).toBe(true);
      }
      expect(Object.values(tally).reduce((sum, n) => sum + n, 0)).toBe(
        unmatched(game.state.cards).length,
      );
    }
  });

  it('actually changes the arrangement', () => {
    // A no-op would leave the player's mental map intact and defeat the point.
    const cards = buildDeck();
    const before = cards.map((card) => card.fruit).join();
    silentReshuffle(cards, 0);
    expect(cards.map((card) => card.fruit).join()).not.toBe(before);
  });

  it('does not clear lastShown', () => {
    // Task 19's exclusion 2 depends on it. Clearing it would let a card
    // redisplay the fruit it just showed.
    const cards = buildDeck();
    cards[3].lastShown = 'tomato';
    silentReshuffle(cards, 0);
    expect(cards[3].lastShown).toBe('tomato');
  });
});
