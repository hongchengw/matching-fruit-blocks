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
  it('never runs after a match', () => {
    const game = createGame({
      deck: ['apple', 'apple', 'banana', 'banana']
        .concat(Array(32).fill('corn'))
        .map((fruit, id) => ({ id, fruit, state: 'down', lastShown: null })),
      rigLevel: 999,
    });

    const before = game.state.cards.map((card) => card.fruit).join();
    game.flip(0);
    game.flip(1);
    expect(game.state.cards.map((card) => card.fruit).join()).toBe(before);
  });

  it('runs after a failed attempt once the rig has armed', () => {
    const game = riggedGame();
    const before = game.state.cards.map((card) => card.fruit).join();
    failOnce(game);
    expect(game.state.cards.map((card) => card.fruit).join()).not.toBe(before);
  });

  /*
   * The gate (SPEC.md §2.5, §6.5, §7.3).
   *
   * This test used to drive the reshuffle through an honest game, because the
   * spec asked for it after *every* failed attempt. It is split rather than
   * deleted: the half about matches is unchanged and still honest, and the half
   * about failures moved to a rigged board, which is the only place a failure
   * now reshuffles anything.
   */
  it('does not run during the honest phase', () => {
    const game = createGame({ deck: buildDeck(), rigLevel: 5 });
    expect(game.state.rigged).toBe(false);

    const before = game.state.cards.map((card) => card.fruit).join();
    failOnce(game);
    expect(game.state.rigged).toBe(false);
    expect(game.state.cards.map((card) => card.fruit).join()).toBe(before);
  });

  it('stays still for every honest failure, not just the first', () => {
    const game = createGame({ deck: buildDeck(), rigLevel: 5 });
    const before = game.state.cards.map((card) => card.fruit).join();
    for (let i = 0; i < 8; i += 1) {
      failOnce(game);
      expect(game.state.cards.map((card) => card.fruit).join()).toBe(before);
    }
  });

  it('gates on rigged rather than on a hardcoded threshold', () => {
    // rigLevel 1: one honest match, then the board starts moving.
    const game = createGame({ deck: buildDeck(), rigLevel: 1 });
    const before = game.state.cards.map((card) => card.fruit).join();
    failOnce(game);
    expect(game.state.cards.map((card) => card.fruit).join()).toBe(before);

    const cards = game.state.cards;
    const pair = (() => {
      for (let i = 0; i < cards.length; i += 1) {
        for (let j = i + 1; j < cards.length; j += 1) {
          if (cards[i].state === 'down' && cards[j].state === 'down' && cards[i].fruit === cards[j].fruit) {
            return [cards[i], cards[j]];
          }
        }
      }
      return null;
    })();
    game.flip(pair[0].id);
    game.flip(pair[1].id);
    expect(game.state.rigged).toBe(true);

    const armed = game.state.cards.map((card) => card.fruit).join();
    failOnce(game);
    expect(game.state.cards.map((card) => card.fruit).join()).not.toBe(armed);
  });

  it('keeps every unmatched fruit count even across the phase boundary', () => {
    // The tally invariant (SPEC.md §10.3) under the gate. The reroll is the
    // only thing that makes counts odd and it only runs when rigged, so gating
    // the repair on the same condition leaves nothing unrepaired.
    const game = createGame({ deck: buildDeck(), rigLevel: 3 });
    expect(everyCountEven(game.state.cards)).toBe(true);

    for (let i = 0; i < 40; i += 1) {
      const down = game.state.cards.filter((card) => card.state === 'down');
      const first = down[0];
      const partner = down.find((card) => card.fruit === first.fruit && card.id !== first.id);
      // Alternate between trying to match and deliberately missing, so the run
      // crosses the threshold and then keeps going past it.
      const second = i % 3 === 0 && partner ? partner : down.find((c) => c.fruit !== first.fruit);
      if (!second) break;
      game.flip(first.id);
      game.flip(second.id);
      vi.advanceTimersByTime(DEFAULT_FLIP_MS);
      vi.advanceTimersByTime(1000);
      expect(everyCountEven(game.state.cards), `odd count after attempt ${i + 1}`).toBe(true);
    }
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
