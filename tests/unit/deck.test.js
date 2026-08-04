import { describe, it, expect } from 'vitest';
import { buildDeck, shuffle, FRUITS } from '../../js/game.js';

// SPEC.md §2.1 (board composition) and §5 (state model).
//
// These two functions are pure and stay that way. Task 16 introduces mutable
// state; the deck helpers must remain independently testable without it.

function countByFruit(cards) {
  return cards.reduce((counts, card) => {
    counts[card.fruit] = (counts[card.fruit] ?? 0) + 1;
    return counts;
  }, {});
}

describe('buildDeck', () => {
  it('builds 36 cards', () => {
    expect(buildDeck()).toHaveLength(36);
  });

  it('gives every card the state model shape', () => {
    for (const card of buildDeck()) {
      // `lastSeenAt` joined the shape in task 27 (SPEC.md §5, §7.3). It records
      // *when* the player last saw a card, for the recency window, and is
      // deliberately separate from `lastShown`, which records *what* they saw,
      // for task 19's exclusion rule.
      expect(Object.keys(card).sort()).toEqual([
        'fruit',
        'id',
        'lastSeenAt',
        'lastShown',
        'state',
      ]);
    }
  });

  it('numbers ids 0 through 35 with no gaps', () => {
    const ids = buildDeck()
      .map((card) => card.id)
      .sort((a, b) => a - b);
    expect(ids).toEqual([...Array(36).keys()]);
  });

  it('starts every card face down with nothing shown', () => {
    for (const card of buildDeck()) {
      expect(card.state).toBe('down');
      expect(card.lastShown).toBeNull();
    }
  });

  it('uses exactly the six spec fruits', () => {
    const used = [...new Set(buildDeck().map((card) => card.fruit))].sort();
    expect(used).toEqual(['apple', 'banana', 'carrot', 'corn', 'pumpkin', 'tomato']);
    // The shared list and the board must not drift apart.
    expect([...FRUITS].sort()).toEqual(used);
  });

  it('deals each fruit exactly six times', () => {
    // Six of each is 3 pairs each, 18 pairs total (SPEC.md §2.1).
    const counts = countByFruit(buildDeck());
    expect(Object.values(counts)).toEqual([6, 6, 6, 6, 6, 6]);
  });

  it('deals an even count of every fruit', () => {
    // Deliberately redundant with the previous test at setup. This is the same
    // assertion task 20 makes after arbitrary reroll and reshuffle sequences,
    // and stating it here establishes the tally invariant at its origin.
    for (const count of Object.values(countByFruit(buildDeck()))) {
      expect(count % 2).toBe(0);
    }
  });

  it('does not deal the same board twice in a row', () => {
    const a = buildDeck().map((card) => card.fruit);
    const b = buildDeck().map((card) => card.fruit);
    expect(a).not.toEqual(b);
  });
});

describe('shuffle', () => {
  const source = [...Array(20).keys()];

  it('permutes the order', () => {
    // Guards against a no-op shuffle. A single run can legitimately come back
    // in order, so require at least one reordering across several runs.
    const reordered = Array.from({ length: 10 }, () => shuffle(source)).some(
      (out) => !out.every((v, i) => v === source[i]),
    );
    expect(reordered).toBe(true);
  });

  it('preserves the multiset', () => {
    // Dropping or duplicating an element would silently break the pair count.
    const out = shuffle(['a', 'a', 'b', 'c', 'c', 'c']);
    expect([...out].sort()).toEqual(['a', 'a', 'b', 'c', 'c', 'c']);
  });

  it('is unbiased', () => {
    // Catches the classic Fisher-Yates off-by-one that never moves the last
    // element: every position must be able to receive every value.
    const size = 5;
    const seen = Array.from({ length: size }, () => new Set());
    for (let run = 0; run < 500; run += 1) {
      shuffle([...Array(size).keys()]).forEach((value, position) => {
        seen[position].add(value);
      });
    }
    for (const positionSet of seen) {
      expect(positionSet.size).toBe(size);
    }
  });

  it('does not mutate its input', () => {
    // task 20's silentReshuffle regenerates rather than permutes in place and
    // relies on this.
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const copy = [...input];
    shuffle(input);
    expect(input).toEqual(copy);
  });

  it('accepts an injected random source', () => {
    // Deterministic randomness keeps the rig's tests reproducible later.
    const scripted = shuffle([...Array(8).keys()], () => 0);
    expect(scripted).toEqual(shuffle([...Array(8).keys()], () => 0));
    expect(scripted).toHaveLength(8);
  });
});
