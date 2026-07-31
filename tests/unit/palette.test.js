import { describe, it, expect } from 'vitest';
import { PALETTE, TRANSPARENT, isTransparent } from '../../js/palette.js';

// SPEC.md §3.1. Roles required by the spec table.
const REQUIRED_KEYS = ['K', 'R', 'r', 'O', 'o', 'Y', 'y', 'G', 'g', 'B', 'b', 'W'];

/** Convert #rrggbb to {h, s, l} with h in degrees and s/l in 0..1. */
function toHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}

const colors = () =>
  Object.entries(PALETTE).filter(([, v]) => !isTransparent(v));

describe('palette', () => {
  it('exports a palette object', () => {
    expect(PALETTE).toBeTypeOf('object');
    expect(PALETTE).not.toBeNull();
    expect(Object.keys(PALETTE).length).toBeGreaterThanOrEqual(12);
  });

  it('every value is a valid hex color', () => {
    for (const [key, value] of colors()) {
      expect(value, `key ${key}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('dot is transparent', () => {
    // The renderer (task 03) skips pixels on this sentinel. A stray empty
    // string or undefined would silently paint black.
    expect(PALETTE['.']).toBe(TRANSPARENT);
    expect(isTransparent(PALETTE['.'])).toBe(true);
    expect(typeof PALETTE['.']).not.toBe('string');
  });

  it('covers every role in the spec', () => {
    for (const key of REQUIRED_KEYS) {
      expect(Object.keys(PALETTE), `missing role ${key}`).toContain(key);
    }
    expect(Object.keys(PALETTE)).toContain('.');
  });

  it('colors are distinguishable', () => {
    // Two identical hex values would make a sprite's shading invisible.
    const values = colors().map(([, v]) => v.toLowerCase());
    expect(new Set(values).size).toBe(values.length);
  });

  it('palette is earth-toned', () => {
    // Encodes the SPEC.md §3.1 brief so nobody drops a neon accent in later.
    for (const [key, value] of colors()) {
      const { h, s, l } = toHsl(value);
      expect(s, `${key} is oversaturated`).toBeLessThanOrEqual(0.85);
      // Near-neutrals (outline, bone white) have no meaningful hue.
      if (s > 0.12 && l > 0.08 && l < 0.95) {
        const inColdRange = h > 200 && h < 300;
        expect(inColdRange, `${key} hue ${h.toFixed(0)} is blue/violet`).toBe(false);
      }
    }
  });

  it('lowercase keys are lighter than their uppercase base', () => {
    // SPEC.md §3.1: uppercase is the base tone, lowercase its highlight.
    for (const key of ['r', 'o', 'y', 'g', 'b']) {
      const base = toHsl(PALETTE[key.toUpperCase()]);
      const highlight = toHsl(PALETTE[key]);
      expect(highlight.l, `${key} is not lighter than ${key.toUpperCase()}`)
        .toBeGreaterThan(base.l);
    }
  });

  it('palette is frozen', () => {
    // Read on every draw; must not be mutable at runtime.
    expect(Object.isFrozen(PALETTE)).toBe(true);
  });
});
