import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// SPEC.md §2.5 and §7.3. Only cards the player has not looked at recently are
// eligible to be reshuffled, so their fresh memories stay true and their older
// ones rot. Forgetting takes old things first.

vi.mock('../../js/audio.js', () => ({
  beepFlip: vi.fn(),
  beepMatch: vi.fn(),
  beepMismatch: vi.fn(),
  isMuted: vi.fn(() => false),
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
}));

const { createGame, silentReshuffle, buildDeck, RECENCY_WINDOW, DEFAULT_FLIP_MS } = await import(
  '../../js/game.js'
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

const unmatched = (cards) => cards.filter((c) => c.state !== 'locked');

function counts(cards) {
  return unmatched(cards).reduce((acc, card) => {
    acc[card.fruit] = (acc[card.fruit] ?? 0) + 1;
    return acc;
  }, {});
}

const everyCountEven = (cards) => Object.values(counts(cards)).every((n) => n % 2 === 0);

/** A rigged game, so every failure reshuffles. */
const riggedGame = () => createGame({ deck: buildDeck(), rigLevel: 0 });

/**
 * Fail one attempt on two deliberately different fruits.
 *
 * Returns the two cards and the fruits they were showing **before** the
 * reshuffle ran. Reading `card.fruit` after the fact is reading the result of
 * the very mutation under test, which is how the first draft of these tests
 * managed to pass against an implementation that moved everything.
 */
function failOnce(game) {
  const down = game.state.cards.filter((c) => c.state === 'down');
  const first = down[0];
  const second = down.find((c) => c.fruit !== first.fruit);
  if (!second) return null;
  game.flip(first.id);
  game.flip(second.id);
  vi.advanceTimersByTime(DEFAULT_FLIP_MS);
  // The identities the player was just shown, captured before the reshuffle.
  const shown = [first.fruit, second.fruit];
  vi.advanceTimersByTime(1000);
  return { cards: [first, second], shown };
}

describe('the recency window', () => {
  it('is one named constant', () => {
    expect(Number.isInteger(RECENCY_WINDOW)).toBe(true);
    expect(RECENCY_WINDOW).toBeGreaterThan(0);
  });
});

describe('cold-card reshuffle', () => {
  it('leaves a card the player just revealed alone', () => {
    const game = riggedGame();
    const { cards, shown } = failOnce(game);

    // Both cards were revealed on the attempt that just failed, so both are
    // warm and neither may have moved.
    expect(cards[0].fruit, 'the card just revealed changed under the player').toBe(shown[0]);
    expect(cards[1].fruit, 'the card just revealed changed under the player').toBe(shown[1]);
  });

  it('keeps a card warm for the whole recency window', () => {
    const game = riggedGame();
    const { cards, shown } = failOnce(game);
    const watched = cards[0];

    // Play elsewhere, but only within the window. It must still be honoured.
    for (let i = 0; i < RECENCY_WINDOW - 1; i += 1) {
      const down = game.state.cards.filter((c) => c.state === 'down' && c.id !== watched.id);
      const first = down[0];
      const second = down.find((c) => c.fruit !== first.fruit && c.id !== watched.id);
      if (!second) break;
      game.flip(first.id);
      game.flip(second.id);
      vi.advanceTimersByTime(DEFAULT_FLIP_MS);
      vi.advanceTimersByTime(1000);
      expect(watched.fruit, `moved while still warm, ${i + 1} attempts later`).toBe(shown[0]);
    }
  });

  it('moves a card the player has not looked at in a while', () => {
    const game = riggedGame();
    const { cards } = failOnce(game);
    const watched = cards[0];
    const original = watched.fruit;

    // Play elsewhere until the watched card goes cold, then keep going.
    let moved = false;
    for (let i = 0; i < 40 && !moved; i += 1) {
      const down = game.state.cards.filter((c) => c.state === 'down' && c.id !== watched.id);
      const first = down[0];
      const second = down.find((c) => c.fruit !== first.fruit);
      if (!second) break;
      game.flip(first.id);
      game.flip(second.id);
      vi.advanceTimersByTime(DEFAULT_FLIP_MS);
      vi.advanceTimersByTime(1000);
      if (watched.fruit !== original) moved = true;
    }
    expect(moved, 'a long-forgotten card never moved').toBe(true);
  });

  it('keeps every unmatched fruit count even', () => {
    // The invariant most at risk in this task: the regenerator no longer owns
    // every slot and has to build around the warm cards' fruits.
    const game = riggedGame();
    for (let i = 0; i < 300; i += 1) {
      if (!failOnce(game)) break;
      expect(everyCountEven(game.state.cards), `odd count after attempt ${i + 1}`).toBe(true);
    }
  });

  it('leaves a board that can still be paired off completely', () => {
    // Even counts alone do not guarantee this once the reshuffle stops being
    // free to move everything.
    const game = riggedGame();
    for (let i = 0; i < 200; i += 1) {
      if (!failOnce(game)) break;
      const tally = counts(game.state.cards);
      const total = Object.values(tally).reduce((a, b) => a + b, 0);
      expect(total % 2, `board has an odd card count after attempt ${i + 1}`).toBe(0);
      for (const [fruit, n] of Object.entries(tally)) {
        expect(n % 2, `${fruit} is odd after attempt ${i + 1}`).toBe(0);
      }
    }
  });

  it('never touches locked cards', () => {
    const game = createGame({ deck: buildDeck(), rigLevel: 999 });
    const cards = game.state.cards;
    const pair = (() => {
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

  it('still changes the arrangement', () => {
    // A gate that froze everything would satisfy the warm-card tests above.
    const game = riggedGame();
    const before = game.state.cards.map((c) => c.fruit).join();
    failOnce(game);
    expect(game.state.cards.map((c) => c.fruit).join()).not.toBe(before);
  });

  it('does not make the first rigged failure an outlier', () => {
    // The onset must not be observable. Most of the board is already cold when
    // the rig arms, so the first rigged failure should move about as much as a
    // later one.
    const game = riggedGame();
    const moveCount = () => {
      const before = game.state.cards.map((c) => c.fruit);
      failOnce(game);
      return game.state.cards.filter((c, i) => c.fruit !== before[i]).length;
    };
    const first = moveCount();
    const later = [moveCount(), moveCount(), moveCount(), moveCount()];
    const average = later.reduce((a, b) => a + b, 0) / later.length;
    expect(Math.abs(first - average), 'the first rigged failure was an outlier').toBeLessThan(10);
  });
});
