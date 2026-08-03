/**
 * Farmer's Match. See SPEC.md §5 and §6.
 *
 * Layout of this file, which later tasks extend rather than reorganize:
 *
 *   1. Pure deck helpers (task 15)  - no state, no DOM, independently testable
 *   2. State machine   (task 16)
 *   3. Rendering       (task 16)
 */
import { FRUITS } from './sprites.js';

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
