import { describe, it, expect } from 'vitest';

describe('test tooling', () => {
  it('vitest runner executes', () => {
    expect(1 + 1).toBe(2);
  });

  it('jsdom environment is available', () => {
    // Fails under the default `node` environment. Proves jsdom is actually
    // configured rather than assumed. Later tasks need `document` (canvas
    // rendering) and `localStorage` (persistence).
    expect(typeof document).not.toBe('undefined');
    expect(typeof localStorage).not.toBe('undefined');
  });
});
