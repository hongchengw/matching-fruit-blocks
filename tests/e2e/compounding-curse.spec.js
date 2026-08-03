import { test, expect } from '@playwright/test';

// SPEC.md §2.7, §2.8, §8, and the persistence invariant in §10.3.
//
// Trying harder makes it worse, and there is no way out that the game will
// ever mention.

const TEST_PAGE = '/?fm-test=1';

const rigLevel = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('fm.state') ?? '{}').rigLevel);

const reset = (page) => page.locator('[data-control="reset"]').click();

/** Drive the curse all the way down. */
async function maxCurse(page) {
  for (let i = 0; i < 6; i += 1) await reset(page);
  expect(await rigLevel(page)).toBe(0);
}

test('six resets drive the curse to zero', async ({ page }) => {
  await page.goto(TEST_PAGE);
  expect(await rigLevel(page)).toBe(5);

  for (const expected of [4, 3, 2, 1, 0, 0]) {
    await reset(page);
    expect(await rigLevel(page)).toBe(expected);
  }
});

test('at rigLevel 0 the very first attempt fails', async ({ page }) => {
  await page.goto(TEST_PAGE);
  await maxCurse(page);

  const pair = await page.evaluate(() => {
    const cards = window.__fmTest.cards();
    for (let i = 0; i < cards.length; i += 1) {
      for (let j = i + 1; j < cards.length; j += 1) {
        if (cards[i].fruit === cards[j].fruit) return [cards[i].id, cards[j].id];
      }
    }
    return null;
  });

  await page.locator(`[data-card="${pair[0]}"]`).click();
  await page.locator(`[data-card="${pair[1]}"]`).click();

  await expect(page.locator(`[data-card="${pair[1]}"]`)).toHaveAttribute('data-state', 'down', {
    timeout: 3000,
  });
  expect(await page.evaluate(() => window.__fmTest.state().matches)).toBe(0);
  expect(await page.locator('[data-card][data-state="locked"]').count()).toBe(0);
});

test('the curse survives a reload', async ({ page }) => {
  await page.goto(TEST_PAGE);
  await maxCurse(page);

  await page.reload();
  expect(await rigLevel(page)).toBe(0);
  expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(true);

  const pair = await page.evaluate(() => {
    const cards = window.__fmTest.cards();
    const first = cards[0];
    const twin = cards.find((c) => c.id !== first.id && c.fruit === first.fruit);
    return [first.id, twin.id];
  });
  await page.locator(`[data-card="${pair[0]}"]`).click();
  await page.locator(`[data-card="${pair[1]}"]`).click();
  await expect(page.locator(`[data-card="${pair[1]}"]`)).toHaveAttribute('data-state', 'down', {
    timeout: 3000,
  });
  expect(await page.evaluate(() => window.__fmTest.state().matches)).toBe(0);
});

test('the curse survives a browser restart', async ({ browser, baseURL }) => {
  // localStorage, not session or in-memory storage.
  const first = await browser.newContext();
  const page = await first.newPage();
  await page.goto(`${baseURL}/?fm-test=1`);
  await maxCurse(page);
  const state = await first.storageState();
  await first.close();

  const second = await browser.newContext({ storageState: state });
  const revived = await second.newPage();
  await revived.goto(`${baseURL}/?fm-test=1`);
  expect(await rigLevel(revived)).toBe(0);
  expect(await revived.evaluate(() => window.__fmTest.state().rigged)).toBe(true);
  await second.close();
});

test('no escape hatch exists', async ({ page }) => {
  // A standing guard so nobody adds a kindly escape later (SPEC.md §2.8).
  await page.goto(TEST_PAGE);
  await maxCurse(page);

  // Every interactive element except the reset button, which is the one
  // control that is allowed to touch rigLevel, and only downward.
  const controls = page.locator('button:not([data-control="reset"]), a, input, [tabindex]');
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    await controls.nth(i).click({ force: true, timeout: 2000 }).catch(() => {});
  }

  // The signboard, hammered, and the cheat codes someone will inevitably try.
  const signboard = page.locator('[data-region="signboard"]');
  for (let i = 0; i < 10; i += 1) await signboard.click({ force: true });
  await page.keyboard.press('Escape');
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'KeyB', 'KeyA']) {
    await page.keyboard.press(key);
  }
  await page.keyboard.type('reset');

  expect(await rigLevel(page)).toBe(0);
  expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(true);
});

test('resetting does not announce itself', async ({ page }) => {
  // The player must never learn that resetting made it worse.
  await page.goto('/');
  const before = await page.locator('.stall').innerText();

  await reset(page);
  await page.waitForTimeout(200);
  const after = await page.locator('.stall').innerText();

  // The press really did cost the player something, and the page said nothing
  // about it. Silence is only meaningful alongside the first half.
  expect(await rigLevel(page)).toBe(4);
  expect(after).toBe(before);
  expect(after.toLowerCase()).not.toMatch(/harder|again|sure|warning|level|curse/);
  expect(await page.locator('dialog, [role="alert"], [role="dialog"]').count()).toBe(0);
});
