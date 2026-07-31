import { test, expect } from '@playwright/test';

// Shared distinctness suite. Each of tasks 04 through 10 adds its sprite here.
// With a single entry the pairwise check is vacuously true; it becomes the real
// gate once a second sprite lands.
const SPRITE_NAMES = ['apple', 'banana', 'carrot', 'corn'];

// The size a card renders at on the smallest supported viewport (SPEC.md §3.2).
const CARD_PX = 44;

// Fraction of the bounding box that must differ between two silhouettes.
const SILHOUETTE_THRESHOLD = 0.12;

// Fraction of source opacity a downscaled render may drift by.
const OPACITY_TOLERANCE = 0.08;

/**
 * Render every named sprite at CARD_PX and return, per sprite, its binary
 * alpha mask and its opaque ratio.
 */
async function renderAll(page, names) {
  await page.goto('/');
  return page.evaluate(
    async ({ names, size }) => {
      const { drawSprite, SPRITES, SPRITE_SIZE } = await import('/js/sprites.js');
      const { PALETTE } = await import('/js/palette.js');

      const out = {};
      for (const name of names) {
        const native = document.createElement('canvas');
        drawSprite(native, name);

        const scaled = document.createElement('canvas');
        scaled.width = size;
        scaled.height = size;
        const ctx = scaled.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(native, 0, 0, size, size);

        const { data } = ctx.getImageData(0, 0, size, size);
        const mask = [];
        for (let i = 3; i < data.length; i += 4) mask.push(data[i] > 0 ? 1 : 0);

        let sourceOpaque = 0;
        for (const row of SPRITES[name]) {
          for (const char of row) if (PALETTE[char] !== null) sourceOpaque += 1;
        }

        out[name] = {
          mask,
          renderedRatio: mask.reduce((a, b) => a + b, 0) / mask.length,
          sourceRatio: sourceOpaque / (SPRITE_SIZE * SPRITE_SIZE),
        };
      }
      return out;
    },
    { names, size: CARD_PX },
  );
}

test('sprites render legibly at 44px', async ({ page }) => {
  const rendered = await renderAll(page, SPRITE_NAMES);
  for (const name of SPRITE_NAMES) {
    const { renderedRatio, sourceRatio } = rendered[name];
    // Catches sprites that vanish or bloat when scaled down.
    expect(Math.abs(renderedRatio - sourceRatio), `${name} opacity drift`).toBeLessThan(
      OPACITY_TOLERANCE,
    );
    expect(renderedRatio, `${name} rendered blank`).toBeGreaterThan(0.05);
  }
});

test('every pair of sprites is distinct at 44px', async ({ page }) => {
  const rendered = await renderAll(page, SPRITE_NAMES);
  for (let i = 0; i < SPRITE_NAMES.length; i += 1) {
    for (let j = i + 1; j < SPRITE_NAMES.length; j += 1) {
      const a = rendered[SPRITE_NAMES[i]].mask;
      const b = rendered[SPRITE_NAMES[j]].mask;
      let differing = 0;
      for (let k = 0; k < a.length; k += 1) if (a[k] !== b[k]) differing += 1;
      const ratio = differing / a.length;
      expect(
        ratio,
        `${SPRITE_NAMES[i]} vs ${SPRITE_NAMES[j]} silhouettes are too similar`,
      ).toBeGreaterThan(SILHOUETTE_THRESHOLD);
    }
  }
});
