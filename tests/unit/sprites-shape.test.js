import { describe, it, expect } from 'vitest';
import { SPRITES, SPRITE_SIZE } from '../../js/sprites.js';
import { PALETTE, isTransparent } from '../../js/palette.js';

// Shared shape suite. Each of tasks 04 through 10 adds its sprite here.
const SHAPE_SPRITES = ['apple', 'banana', 'carrot', 'corn', 'tomato', 'pumpkin'];

// The card back (task 10) is a full-bleed texture with no transparent pixels,
// so the outline rule does not apply to it. Exempt it rather than loosening
// the test for the fruits.
const OUTLINE_EXEMPT = ['back'];

const MIN_OPAQUE = 40;

const opaqueAt = (grid, x, y) => {
  if (x < 0 || y < 0 || x >= SPRITE_SIZE || y >= SPRITE_SIZE) return false;
  return !isTransparent(PALETTE[grid[y][x]]);
};

describe.each(SHAPE_SPRITES)('sprite %s', (name) => {
  it('is registered', () => {
    expect(SPRITES[name]).toBeDefined();
  });

  it('is a 16x16 grid', () => {
    const grid = SPRITES[name];
    expect(grid).toHaveLength(SPRITE_SIZE);
    for (const row of grid) {
      expect(row).toHaveLength(SPRITE_SIZE);
    }
  });

  it('uses only palette chars', () => {
    for (const row of SPRITES[name]) {
      for (const char of row) {
        expect(Object.keys(PALETTE), `unmapped char ${char}`).toContain(char);
      }
    }
  });

  it('is not blank', () => {
    // A grid of all dots would pass every other shape test while rendering an
    // empty card.
    const grid = SPRITES[name];
    let opaque = 0;
    for (let y = 0; y < SPRITE_SIZE; y += 1) {
      for (let x = 0; x < SPRITE_SIZE; x += 1) {
        if (opaqueAt(grid, x, y)) opaque += 1;
      }
    }
    expect(opaque).toBeGreaterThanOrEqual(MIN_OPAQUE);
  });

  it('has a 1px transparent margin', () => {
    const grid = SPRITES[name];
    if (OUTLINE_EXEMPT.includes(name)) return;
    for (let i = 0; i < SPRITE_SIZE; i += 1) {
      expect(opaqueAt(grid, i, 0), `top edge at ${i}`).toBe(false);
      expect(opaqueAt(grid, i, SPRITE_SIZE - 1), `bottom edge at ${i}`).toBe(false);
      expect(opaqueAt(grid, 0, i), `left edge at ${i}`).toBe(false);
      expect(opaqueAt(grid, SPRITE_SIZE - 1, i), `right edge at ${i}`).toBe(false);
    }
  });

  it('has an outline', () => {
    // Sprites without a closed outline read as mush at 44px. Every opaque
    // pixel touching transparency (or the grid edge) must be the outline key.
    if (OUTLINE_EXEMPT.includes(name)) return;
    const grid = SPRITES[name];
    for (let y = 0; y < SPRITE_SIZE; y += 1) {
      for (let x = 0; x < SPRITE_SIZE; x += 1) {
        if (!opaqueAt(grid, x, y)) continue;
        const onBoundary =
          !opaqueAt(grid, x - 1, y) ||
          !opaqueAt(grid, x + 1, y) ||
          !opaqueAt(grid, x, y - 1) ||
          !opaqueAt(grid, x, y + 1);
        if (onBoundary) {
          expect(grid[y][x], `${name} boundary pixel at ${x},${y} is not outline`).toBe('K');
        }
      }
    }
  });
});
