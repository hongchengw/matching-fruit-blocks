import { test, expect } from '@playwright/test';

// SPEC.md §2.5 and §7.3. The reshuffle destroys the player's mental map without
// ever admitting it happened: no animation, no sound, no visual change of any
// kind. An honest shuffle would tell the player that memory is futile. Silence
// keeps them trying.

const TEST_PAGE = '/?fm-test=1';

/** Record when the page builds an oscillator, which is when a cue plays. */
async function recordCues(page) {
  await page.addInitScript(() => {
    window.__cueTimes = [];
    const Real = window.AudioContext ?? window.webkitAudioContext;
    class Recording extends Real {
      createOscillator() {
        window.__cueTimes.push(performance.now());
        return super.createOscillator();
      }
    }
    window.AudioContext = Recording;
    window.webkitAudioContext = Recording;
  });
}

/** Two face-down cards of different fruits, so the attempt always fails. */
async function mismatchPair(page) {
  return page.evaluate(() => {
    const down = window.__fmTest.cards().filter((c) => c.state === 'down');
    const first = down[0];
    return { first: first.id, second: down.find((c) => c.fruit !== first.fruit).id };
  });
}

test('the reshuffle emits no sound', async ({ page }) => {
  await recordCues(page);
  await page.goto(TEST_PAGE);

  const identitiesBefore = await page.evaluate(() =>
    window.__fmTest.cards().map((c) => c.fruit).join(),
  );

  const pair = await mismatchPair(page);
  await page.locator(`[data-card="${pair.first}"]`).click();

  const started = await page.evaluate((id) => {
    document.querySelector(`[data-card="${id}"]`).click();
    return performance.now();
  }, pair.second);

  await expect(page.locator(`[data-card="${pair.second}"]`)).toHaveAttribute(
    'data-state',
    'down',
    { timeout: 3000 },
  );
  await page.waitForTimeout(400);

  // The flip and mismatch cues fire at click time. The reshuffle happens a
  // second later, when the cards land face down, and must be silent.
  const duringReshuffle = await page.evaluate(
    (from) => window.__cueTimes.filter((t) => t > from).length,
    started + 300,
  );
  expect(duringReshuffle).toBe(0);

  // Silence only counts if a reshuffle actually happened in that window.
  const identitiesAfter = await page.evaluate(() =>
    window.__fmTest.cards().map((c) => c.fruit).join(),
  );
  expect(identitiesAfter).not.toBe(identitiesBefore);

  // And the recorder has to have heard the honest cues, or it hears nothing.
  expect(await page.evaluate(() => window.__cueTimes.length)).toBeGreaterThan(0);
});

test('the reshuffle produces no visual change', async ({ page }) => {
  await page.goto(TEST_PAGE);
  const grid = page.locator('[data-region="grid"]');

  const before = await grid.screenshot();
  const identitiesBefore = await page.evaluate(() =>
    window.__fmTest.cards().map((c) => c.fruit).join(),
  );

  const pair = await mismatchPair(page);
  await page.locator(`[data-card="${pair.first}"]`).click();
  await page.locator(`[data-card="${pair.second}"]`).click();
  await expect(page.locator(`[data-card="${pair.second}"]`)).toHaveAttribute(
    'data-state',
    'down',
    { timeout: 3000 },
  );
  await page.waitForTimeout(400);

  // Drop the focus ring the click left behind. It is a legitimate consequence
  // of clicking, not of the reshuffle, and this test is about the reshuffle.
  await page.evaluate(() => document.activeElement?.blur());

  const after = await grid.screenshot();
  const identitiesAfter = await page.evaluate(() =>
    window.__fmTest.cards().map((c) => c.fruit).join(),
  );

  // Every hidden identity moved, and the board is pixel for pixel the same.
  expect(identitiesAfter).not.toBe(identitiesBefore);
  expect(Buffer.compare(before, after)).toBe(0);
});

test('the reshuffle does not disturb the flip-back timing', async ({ page }) => {
  // A measurable pause where the board rearranges itself would be a tell.
  const cycle = async () =>
    page.evaluate(async () => {
      const down = window.__fmTest.cards().filter((c) => c.state === 'down');
      const first = down[0];
      const second = down.find((c) => c.fruit !== first.fruit);
      const target = document.querySelector(`[data-card="${second.id}"]`);

      const before = window.__fmTest.cards().map((c) => c.fruit).join();
      document.querySelector(`[data-card="${first.id}"]`).click();
      const started = performance.now();
      target.click();
      while (window.__fmTest.state().busy) {
        await new Promise((r) => requestAnimationFrame(r));
      }
      const elapsed = performance.now() - started;
      const after = window.__fmTest.cards().map((c) => c.fruit).join();
      return { elapsed, reshuffled: before !== after };
    });

  await page.goto(TEST_PAGE);
  const first = await cycle();
  const second = await cycle();

  for (const measured of [first, second]) {
    // The board rearranged itself inside this window, and the window is still
    // the plain 1000ms from SPEC.md §6.
    expect(measured.reshuffled).toBe(true);
    expect(measured.elapsed).toBeGreaterThan(950);
    expect(measured.elapsed).toBeLessThan(1150);
  }
});
