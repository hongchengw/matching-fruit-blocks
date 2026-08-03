import { test, expect } from '@playwright/test';

// SPEC.md §2.6 and §3.3 item 3. The frozen counter is the primary
// psychological instrument on screen, and its 13 dangling matches stay visible
// forever.

const TEST_PAGE = '/?fm-test=1';

/** Find and click one true pair. Returns false when none is available. */
async function playPair(page) {
  const pair = await page.evaluate(() => {
    const down = window.__fmTest.cards().filter((c) => c.state === 'down');
    for (let i = 0; i < down.length; i += 1) {
      for (let j = i + 1; j < down.length; j += 1) {
        if (down[i].fruit === down[j].fruit) return [down[i].id, down[j].id];
      }
    }
    return null;
  });
  if (!pair) return false;
  await page.locator(`[data-card="${pair[0]}"]`).click();
  await page.locator(`[data-card="${pair[1]}"]`).click();
  await expect(page.locator('[data-card][data-state="up"]')).toHaveCount(0, { timeout: 3000 });
  return true;
}

test('shows both readouts in the scoreboard panel', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('[data-region="scoreboard"]');
  await expect(panel.locator('[data-readout="score"]')).toBeVisible();
  await expect(panel.locator('[data-readout="matches"]')).toHaveText('MATCHES MADE: 0/18');
});

test('renders digits light on dark', async ({ page }) => {
  await page.goto('/');
  const contrast = await page.evaluate(() => {
    const el = document.querySelector('[data-readout="matches"]');
    const cs = getComputedStyle(el);
    const lum = (rgb) => {
      const [r, g, b] = rgb.match(/\d+/g).map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    return { text: lum(cs.color), background: lum(cs.backgroundColor) };
  });
  expect(contrast.text).toBeGreaterThan(contrast.background + 60);
});

test('reads 5/18 once the rig arms', async ({ page }) => {
  await page.goto(TEST_PAGE);
  for (let i = 0; i < 5; i += 1) expect(await playPair(page)).toBe(true);

  expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(true);
  await expect(page.locator('[data-readout="matches"]')).toHaveText('MATCHES MADE: 5/18');
  await expect(page.locator('[data-readout="score"]')).toHaveText('SCORE: 5');
});

test('never advances past the rig threshold', async ({ page }) => {
  // The user-facing form of the frozen-counter decision: 13 matches dangling,
  // permanently visible, forever out of reach.
  //
  // 25 attempts at the spec's 1000ms flip-back is over 30 seconds of real
  // waiting, so this test buys the time rather than shortening the run.
  test.setTimeout(90_000);
  await page.goto(TEST_PAGE);
  for (let i = 0; i < 5; i += 1) expect(await playPair(page)).toBe(true);

  const readout = page.locator('[data-readout="matches"]');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await playPair(page);
    await expect(readout).toHaveText('MATCHES MADE: 5/18');
  }

  expect(await page.evaluate(() => window.__fmTest.state().matches)).toBe(5);
  expect(await page.locator('[data-card][data-state="locked"]').count()).toBe(10);
});
