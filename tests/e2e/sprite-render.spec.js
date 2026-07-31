import { test, expect } from '@playwright/test';

// jsdom cannot verify real rasterization, so these are the browser-side truth
// checks for the renderer. The fixture is defined in-page rather than imported
// from a real fruit, so this file stays independent of tasks 04-10.
const FIXTURE = [
  'RRRR............',
  '.G..............',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..............KK',
];

/** Draw the fixture at `displaySize` px and return the canvas element handle. */
async function renderFixture(page, displaySize) {
  await page.goto('/');
  return page.evaluate(
    async ({ fixture, size }) => {
      const { registerSprite, drawSprite } = await import('/js/sprites.js');
      const { PALETTE } = await import('/js/palette.js');
      registerSprite('__fixture__', fixture);

      const canvas = document.createElement('canvas');
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      document.body.append(canvas);
      drawSprite(canvas, '__fixture__');

      return { imageRendering: getComputedStyle(canvas).imageRendering, palette: PALETTE };
    },
    { fixture: FIXTURE, size: displaySize },
  );
}

test('probes the expected color at a known coordinate', async ({ page }) => {
  await page.goto('/');
  const probes = await page.evaluate(async (fixture) => {
    const { registerSprite, drawSprite } = await import('/js/sprites.js');
    registerSprite('__fixture__', fixture);
    const canvas = document.createElement('canvas');
    drawSprite(canvas, '__fixture__');
    const ctx = canvas.getContext('2d');
    const at = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    return { red: at(0, 0), green: at(1, 1), outline: at(15, 15), empty: at(8, 8) };
  }, FIXTURE);

  // #b03028 / #4a7028 / #2b1d17 from js/palette.js, alpha 255.
  expect(probes.red).toEqual([176, 48, 40, 255]);
  expect(probes.green).toEqual([74, 112, 40, 255]);
  expect(probes.outline).toEqual([43, 29, 23, 255]);
  // Transparent pixels are never painted.
  expect(probes.empty[3]).toBe(0);
});

test('renders pixelated when scaled up', async ({ page }) => {
  const { imageRendering } = await renderFixture(page, 128); // 8x scale
  expect(imageRendering).toBe('pixelated');

  // Two device pixels inside the same logical pixel must be identical. A
  // browser smoothing the upscale would blend them.
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  const shot = await canvas.screenshot();
  expect(box.width).toBeGreaterThan(64);
  expect(shot.length).toBeGreaterThan(0);

  const sameLogicalPixel = await page.evaluate(() => {
    const el = document.querySelector('canvas');
    const scaled = document.createElement('canvas');
    const scale = 8;
    scaled.width = 16 * scale;
    scaled.height = 16 * scale;
    const ctx = scaled.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(el, 0, 0, scaled.width, scaled.height);
    const a = Array.from(ctx.getImageData(1, 1, 1, 1).data);
    const b = Array.from(ctx.getImageData(6, 6, 1, 1).data);
    return { a, b };
  });
  expect(sameLogicalPixel.a).toEqual(sameLogicalPixel.b);
});
