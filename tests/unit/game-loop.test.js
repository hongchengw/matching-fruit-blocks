import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// SPEC.md §5 (state model) and §6 (honest phase behavior in full).
//
// Task 16 is a fully fair game. Nothing here knows about the rig, and the rig
// tasks (18 through 20) must layer on top without changing this loop's shape,
// which is what makes the rigged and honest timings identical for free.

vi.mock('../../js/audio.js', () => ({
  beepFlip: vi.fn(),
  beepMatch: vi.fn(),
  beepMismatch: vi.fn(),
  isMuted: vi.fn(() => false),
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
}));

const { createGame, MISMATCH_DELAY_MS } = await import('../../js/game.js');
const audio = await import('../../js/audio.js');

/** A deck with known positions, so a pair is always where the test says. */
function deckOf(fruits) {
  return fruits.map((fruit, id) => ({ id, fruit, state: 'down', lastShown: null }));
}

/** apple apple banana banana ... : pairs sit at (0,1), (2,3), (4,5)... */
function pairedDeck() {
  const fruits = ['apple', 'banana', 'carrot', 'corn', 'tomato', 'pumpkin'];
  return deckOf(fruits.flatMap((fruit) => [fruit, fruit, fruit, fruit, fruit, fruit]));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('initial state', () => {
  it('matches the state model', () => {
    const game = createGame({ deck: pairedDeck() });
    expect(game.state.first).toBeNull();
    expect(game.state.matches).toBe(0);
    expect(game.state.busy).toBe(false);
    expect(game.state.cards).toHaveLength(36);
    expect(game.state.cards.every((card) => card.state === 'down')).toBe(true);
  });
});

describe('flipping', () => {
  it('reveals the true fruit on the first flip', () => {
    const game = createGame({ deck: pairedDeck() });
    game.flip(7);
    const card = game.state.cards[7];
    expect(card.state).toBe('up');
    expect(card.fruit).toBe('banana');
    expect(card.lastShown).toBe('banana');
    expect(game.state.first).toBe(7);
  });

  it('compares the second flip against the first', () => {
    const match = createGame({ deck: pairedDeck() });
    match.flip(0);
    match.flip(1);
    expect(match.state.matches).toBe(1);

    const mismatch = createGame({ deck: pairedDeck() });
    mismatch.flip(0);
    mismatch.flip(6);
    expect(mismatch.state.matches).toBe(0);
    expect(mismatch.state.cards[0].state).toBe('up');
    expect(mismatch.state.cards[6].state).toBe('up');
  });

  it('locks both cards on a match', () => {
    const game = createGame({ deck: pairedDeck() });
    game.flip(2);
    game.flip(3);
    expect(game.state.cards[2].state).toBe('locked');
    expect(game.state.cards[3].state).toBe('locked');
    expect(game.state.matches).toBe(1);
    expect(game.state.first).toBeNull();
    expect(game.state.busy).toBe(false);
  });

  it('never flips a locked card back', () => {
    const game = createGame({ deck: pairedDeck() });
    game.flip(0);
    game.flip(1);
    game.flip(0);
    game.flip(1);
    vi.advanceTimersByTime(5000);
    expect(game.state.cards[0].state).toBe('locked');
    expect(game.state.cards[1].state).toBe('locked');
    expect(game.state.matches).toBe(1);
    expect(game.state.first).toBeNull();
  });

  it('treats a click on an already-up card as a no-op', () => {
    const game = createGame({ deck: pairedDeck() });
    game.flip(0);
    game.flip(0);
    expect(game.state.first).toBe(0);
    expect(game.state.busy).toBe(false);
    expect(game.state.matches).toBe(0);
    expect(audio.beepFlip).toHaveBeenCalledTimes(1);
  });
});

describe('the mismatch delay', () => {
  it('flips back after exactly 1000ms', () => {
    // SPEC.md §6 fixes this number and §7 requires the rigged phase to match it
    // exactly, so it is pinned here rather than left to the implementation.
    expect(MISMATCH_DELAY_MS).toBe(1000);

    const game = createGame({ deck: pairedDeck() });
    game.flip(0);
    game.flip(6);

    vi.advanceTimersByTime(999);
    expect(game.state.cards[0].state).toBe('up');
    expect(game.state.cards[6].state).toBe('up');

    vi.advanceTimersByTime(1);
    expect(game.state.cards[0].state).toBe('down');
    expect(game.state.cards[6].state).toBe('down');
    expect(game.state.first).toBeNull();
  });

  it('locks input while the delay runs', () => {
    const game = createGame({ deck: pairedDeck() });
    game.flip(0);
    game.flip(6);
    expect(game.state.busy).toBe(true);

    vi.advanceTimersByTime(500);
    game.flip(12);
    game.flip(13);
    expect(game.state.cards[12].state).toBe('down');
    expect(game.state.cards[13].state).toBe('down');
    expect(game.state.matches).toBe(0);
  });

  it('releases the lock once the flip-back completes', () => {
    const game = createGame({ deck: pairedDeck() });
    game.flip(0);
    game.flip(6);
    vi.advanceTimersByTime(1000);
    expect(game.state.busy).toBe(false);

    game.flip(12);
    expect(game.state.cards[12].state).toBe('up');
    expect(game.state.first).toBe(12);
  });
});

describe('cues', () => {
  it('fires the flip cue on every reveal', () => {
    const game = createGame({ deck: pairedDeck() });
    game.flip(0);
    expect(audio.beepFlip).toHaveBeenCalledTimes(1);
    game.flip(6);
    expect(audio.beepFlip).toHaveBeenCalledTimes(2);
  });

  it('fires match and mismatch cues on the right branch', () => {
    const matched = createGame({ deck: pairedDeck() });
    matched.flip(0);
    matched.flip(1);
    expect(audio.beepMatch).toHaveBeenCalledTimes(1);
    expect(audio.beepMismatch).not.toHaveBeenCalled();

    vi.clearAllMocks();

    const missed = createGame({ deck: pairedDeck() });
    missed.flip(0);
    missed.flip(6);
    vi.advanceTimersByTime(1000);
    expect(audio.beepMismatch).toHaveBeenCalledTimes(1);
    expect(audio.beepMatch).not.toHaveBeenCalled();
  });
});

describe('winnability', () => {
  it('locks all 36 cards when every pair is found', () => {
    // The base game is fair. Tasks 18 through 20 take this away; without it, a
    // broken match check would be indistinguishable from the rig.
    const game = createGame({ deck: pairedDeck() });
    for (let id = 0; id < 36; id += 2) {
      game.flip(id);
      game.flip(id + 1);
    }
    expect(game.state.matches).toBe(18);
    expect(game.state.cards.every((card) => card.state === 'locked')).toBe(true);
  });
});
