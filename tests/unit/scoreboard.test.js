import { describe, it, expect, vi } from 'vitest';

// SPEC.md §2.6 (why it freezes, and why that needs no special case) and §3.3.

vi.mock('../../js/audio.js', () => ({
  beepFlip: vi.fn(),
  beepMatch: vi.fn(),
  beepMismatch: vi.fn(),
  isMuted: vi.fn(() => false),
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
}));

const { formatScoreboard, renderScoreboard, PAIR_COUNT } = await import('../../js/game.js');

describe('formatScoreboard', () => {
  it('renders the score from matches', () => {
    expect(formatScoreboard(0).score).toBe('SCORE: 0');
    expect(formatScoreboard(7).score).toBe('SCORE: 7');
  });

  it('renders matches made out of 18', () => {
    // The denominator is the constant from SPEC.md §2.1 and never moves.
    expect(PAIR_COUNT).toBe(18);
    expect(formatScoreboard(0).matches).toBe('MATCHES MADE: 0/18');
  });

  it('updates on every match', () => {
    for (let matches = 0; matches <= 18; matches += 1) {
      expect(formatScoreboard(matches).matches).toBe(`MATCHES MADE: ${matches}/18`);
    }
  });

  it('keeps the denominator fixed across a full playthrough', () => {
    for (let matches = 0; matches <= 18; matches += 1) {
      expect(formatScoreboard(matches).matches.endsWith('/18')).toBe(true);
    }
  });

  it('needs no dedicated code path to freeze', async () => {
    // SPEC.md §2.6: "the freeze is a natural consequence of matches never
    // incrementing again. Do not add logic to force it."
    //
    // A contributor who adds a freeze branch, a rig check, or a high-water
    // cache to make the counter stick fails this test.
    expect(formatScoreboard.length).toBe(1);

    // Not sticky: a lower number after a higher one renders as itself. A cached
    // or clamped high-water mark would fail here.
    formatScoreboard(9);
    expect(formatScoreboard(2).matches).toBe('MATCHES MADE: 2/18');

    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(resolve(process.cwd(), 'js/game.js'), 'utf8');
    const body = source.slice(source.indexOf('export function formatScoreboard'));
    const fn = body.slice(0, body.indexOf('\n}'));
    expect(fn).not.toMatch(/\brig/i);
    expect(fn).not.toMatch(/\bfrozen|freeze|Math\.min|Math\.max\b/);
  });
});

describe('renderScoreboard', () => {
  it('writes both readouts into the panel', () => {
    document.body.innerHTML =
      '<div data-region="scoreboard">' +
      '<span data-readout="score"></span><span data-readout="matches"></span></div>';
    const root = document.querySelector('[data-region="scoreboard"]');

    renderScoreboard(root, 3);
    expect(root.querySelector('[data-readout="score"]').textContent).toBe('SCORE: 3');
    expect(root.querySelector('[data-readout="matches"]').textContent).toBe('MATCHES MADE: 3/18');

    renderScoreboard(root, 4);
    expect(root.querySelector('[data-readout="matches"]').textContent).toBe('MATCHES MADE: 4/18');
  });
});
