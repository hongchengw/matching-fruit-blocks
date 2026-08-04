import { test, expect } from '@playwright/test';

// SPEC.md §6. The game must be genuinely fair before tasks 18 through 20 take
// that away.
//
// Playwright cannot see through a face-down card, so the page exposes a debug
// hook. It is opt-in via ?fm-test=1 and absent in normal play: a global that
// listed every card's fruit would be a detection channel of its own.

const TEST_PAGE = '/?fm-test=1';

/** Card ids of a true pair that has not been matched yet. */
async function findPair(page) {
  return page.evaluate(() => {
    const cards = window.__fmTest.cards();
    for (let i = 0; i < cards.length; i += 1) {
      for (let j = i + 1; j < cards.length; j += 1) {
        if (
          cards[i].state === 'down' &&
          cards[j].state === 'down' &&
          cards[i].fruit === cards[j].fruit
        ) {
          return [cards[i].id, cards[j].id];
        }
      }
    }
    return null;
  });
}

async function findMismatch(page) {
  return page.evaluate(() => {
    const cards = window.__fmTest.cards();
    const first = cards[0];
    const other = cards.find((c) => c.fruit !== first.fruit);
    return [first.id, other.id];
  });
}

const card = (page, id) => page.locator(`[data-card="${id}"]`);

test('the debug hook is opt-in and absent in normal play', async ({ page }) => {
  // Both halves matter. Absence alone would pass against a page with no hook at
  // all, so the presence half is asserted in the same test.
  await page.goto(TEST_PAGE);
  expect(await page.evaluate(() => typeof window.__fmTest?.cards)).toBe('function');

  await page.goto('/');
  expect(await page.evaluate(() => Boolean(window.__fmTest))).toBe(false);
});

test('plays a real match end to end', async ({ page }) => {
  await page.goto(TEST_PAGE);
  const [a, b] = await findPair(page);

  await card(page, a).click();
  await card(page, b).click();

  await expect(card(page, a)).toHaveAttribute('data-state', 'locked');
  await expect(card(page, b)).toHaveAttribute('data-state', 'locked');
  expect(await page.evaluate(() => window.__fmTest.state().matches)).toBe(1);
});

test('plays a real mismatch end to end', async ({ page }) => {
  await page.goto(TEST_PAGE);
  const [a, b] = await findMismatch(page);

  await card(page, a).click();
  await card(page, b).click();
  await expect(card(page, a)).toHaveAttribute('data-state', 'up');

  await expect(card(page, a)).toHaveAttribute('data-state', 'down', { timeout: 3000 });
  await expect(card(page, b)).toHaveAttribute('data-state', 'down');
  expect(await page.evaluate(() => window.__fmTest.state().matches)).toBe(0);
  expect(await page.locator('[data-card][data-state="locked"]').count()).toBe(0);
});

test('ignores rapid clicks during the mismatch delay', async ({ page }) => {
  // Real-browser check that the busy lock survives event timing.
  await page.goto(TEST_PAGE);
  const [a, b] = await findMismatch(page);

  await card(page, a).click();
  await card(page, b).click();

  for (const id of [10, 11, 12, 13, 14, 15]) {
    if (id !== a && id !== b) await card(page, id).click({ force: true });
  }

  const upNow = await page.locator('[data-card][data-state="up"]').count();
  expect(upNow).toBe(2);

  await expect(card(page, a)).toHaveAttribute('data-state', 'down', { timeout: 3000 });
  expect(await page.locator('[data-card]:not([data-state="down"])').count()).toBe(0);
});

test('the honest phase is genuinely winnable', async ({ page }) => {
  // The rig arms at match 5, so the threshold is pushed out of reach to isolate
  // the honest loop. Proving all 18 pairs are findable is what makes the rig a
  // deliberate act rather than an indistinguishable bug in the match check.
  //
  // 36 clicks, each waiting on Playwright's actionability checks, and headless
  // WebKit delivers frames roughly every 130ms. Measured at 21s there with no
  // scenery on the page at all, against a 30s default: this test has been one
  // busy machine away from failing since it was written. The allowance buys
  // time rather than shortening the run, the way task 17's does. All 18 pairs
  // are still played and every one must still lock.
  test.setTimeout(90_000);
  await page.goto('/?fm-test=1&fm-rig=999');

  for (let pair = 0; pair < 18; pair += 1) {
    const found = await findPair(page);
    expect(found, `pair ${pair} should exist`).not.toBeNull();
    await card(page, found[0]).click();
    await card(page, found[1]).click();
    await expect(card(page, found[1])).toHaveAttribute('data-state', 'locked');
  }

  expect(await page.evaluate(() => window.__fmTest.state().matches)).toBe(18);
  expect(await page.locator('[data-card][data-state="locked"]').count()).toBe(36);
});
