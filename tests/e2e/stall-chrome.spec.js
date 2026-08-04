import { test, expect } from '@playwright/test';

// SPEC.md §2.10 (why the chrome matters), §3.3 (stall anatomy).

const region = (page, name) => page.locator(`[data-region="${name}"]`);

/** Parse "rgb(r, g, b)" into HSL, hue in degrees and s/l in 0..1. */
function toHsl(rgb) {
  const [r, g, b] = rgb.match(/\d+/g).map((n) => Number(n) / 255);
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

test('awning renders repeating stripes', async ({ page }) => {
  await page.goto('/');
  const awning = region(page, 'awning');
  const style = await awning.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { image: cs.backgroundImage, height: el.getBoundingClientRect().height };
  });
  expect(style.image).not.toBe('none');
  expect(style.image).toMatch(/repeating-linear-gradient/);
  expect(style.height).toBeGreaterThanOrEqual(16);
});

test('awning spans the full stall width', async ({ page }) => {
  await page.goto('/');
  const awningBox = await region(page, 'awning').boundingBox();
  const stallBox = await page.locator('.stall').boundingBox();
  expect(Math.abs(awningBox.width - stallBox.width)).toBeLessThanOrEqual(1);
});

test('signboard contains the title', async ({ page }) => {
  await page.goto('/');
  const title = region(page, 'signboard').locator('.signboard__title');
  await expect(title).toBeVisible();
  await expect(title).toContainText(/farmer/i);
});

test('signboard contains the mute toggle', async ({ page }) => {
  // Task 14 wires the behavior. This only pins the location per SPEC.md §4.4.
  await page.goto('/');
  const mute = region(page, 'signboard').locator('[data-control="mute"]');
  await expect(mute).toBeVisible();
});

test('grid area has a crate-slat background', async ({ page }) => {
  await page.goto('/');
  const grid = region(page, 'grid');
  const image = await grid.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(image).not.toBe('none');
  expect(image).toMatch(/repeating-linear-gradient/);

  // Banding: two vertical offsets inside the region must differ.
  const box = await grid.boundingBox();
  const shot = await page.screenshot({
    clip: { x: box.x, y: box.y, width: Math.min(box.width, 40), height: Math.min(box.height, 40) },
  });
  expect(shot.length).toBeGreaterThan(0);
});

test('price tags hang from the base', async ({ page }) => {
  await page.goto('/');
  const tags = region(page, 'base').locator('.price-tag');
  await expect(tags).toHaveCount(2);
  const baseTop = (await region(page, 'base').boundingBox()).y;
  for (let i = 0; i < 2; i += 1) {
    const tagBox = await tags.nth(i).boundingBox();
    expect(tagBox.y).toBeGreaterThanOrEqual(baseTop - 1);
  }
});

test('reset button is in the base and uses the bevel primitive', async ({ page }) => {
  // Task 21 wires the behavior.
  await page.goto('/');
  const reset = region(page, 'base').locator('[data-control="reset"]');
  await expect(reset).toBeVisible();
  await expect(reset).toHaveClass(/\bbevel\b/);
});

test('regions stack in the spec order', async ({ page }) => {
  await page.goto('/');
  const tops = {};
  for (const name of ['awning', 'signboard', 'scoreboard', 'grid', 'base']) {
    tops[name] = (await region(page, name).boundingBox()).y;
  }
  expect(tops.awning).toBeLessThan(tops.signboard);
  expect(tops.signboard).toBeLessThan(tops.scoreboard);
  expect(tops.scoreboard).toBeLessThan(tops.grid);
  expect(tops.grid).toBeLessThan(tops.base);
});

test('chrome is warm-toned', async ({ page }) => {
  // Encodes SPEC.md §2.10. The stall must read handmade and trustworthy; a cold
  // arcade look would telegraph malfunction before the rig ever arms.
  //
  // §2.10 is scoped to the stall. The outdoor backdrop behind it (§3.6) is
  // exempt, because a sky cannot be warm-hued and still read as sky. That
  // exemption is deliberately expressed as "the backdrop is not a data-region"
  // rather than by widening the hue band below: widening the band would retire
  // the guard for every region at once, and this band is the only thing holding
  // §2.10.
  await page.goto('/');
  const colors = await page.evaluate(() =>
    [...document.querySelectorAll('[data-region]')].map((el) => ({
      region: el.dataset.region,
      bg: getComputedStyle(el).backgroundColor,
    })),
  );
  expect(colors.length, 'no regions found to check').toBeGreaterThan(0);
  for (const { region: name, bg } of colors) {
    if (bg === 'rgba(0, 0, 0, 0)') continue;
    const { h, s, l } = toHsl(bg);
    if (s <= 0.12 || l <= 0.08 || l >= 0.95) continue;
    expect(h > 200 && h < 300, `${name} hue ${h.toFixed(0)} is cold`).toBe(false);
  }
});

test('only the backdrop is exempt from the warm-tone rule', async ({ page }) => {
  // The escape from §2.10 stays a single documented hole. If a later change
  // hangs a data-region inside the backdrop, or gives the backdrop a region
  // name, this fails rather than silently letting cold chrome through.
  await page.goto('/');
  const shape = await page.evaluate(() => ({
    backdrops: document.querySelectorAll('[data-backdrop]').length,
    backdropIsRegion: document.querySelectorAll('[data-backdrop][data-region]').length,
    regionsInsideBackdrop: document.querySelectorAll('[data-backdrop] [data-region]').length,
    regionsInsideStall: document.querySelectorAll('.stall [data-region]').length,
  }));
  expect(shape.backdrops, 'expected exactly one backdrop layer').toBe(1);
  expect(shape.backdropIsRegion, 'the backdrop must not be a data-region').toBe(0);
  expect(shape.regionsInsideBackdrop, 'a region is hiding inside the backdrop').toBe(0);
  expect(shape.regionsInsideStall, 'the five stall regions moved').toBe(5);
});

test('stall visual snapshot', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.stall')).toHaveScreenshot('stall-baseline.png');
});
