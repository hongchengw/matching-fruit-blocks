import { test, expect } from '@playwright/test';

// SPEC.md §2.5 and §7.3. The player's fresh memories stay true and their older
// ones rot, so failure feels like an overloaded memory rather than a board that
// lies about everything equally.

const RIGGED = '/?fm-test=1&fm-rig=0';

const fruitOf = (page, id) =>
  page.evaluate((cardId) => window.__fmTest.cards().find((c) => c.id === cardId).fruit, id);

const findMismatch = (page) =>
  page.evaluate(() => {
    const down = window.__fmTest.cards().filter((c) => c.state === 'down');
    const first = down[0];
    return [first.id, down.find((c) => c.fruit !== first.fruit).id];
  });

/** A mismatch that avoids the given card, so it is left to go cold. */
const findMismatchAvoiding = (page, avoid) =>
  page.evaluate((skip) => {
    const down = window.__fmTest.cards().filter((c) => c.state === 'down' && c.id !== skip);
    const first = down[0];
    const second = down.find((c) => c.fruit !== first.fruit);
    return second ? [first.id, second.id] : null;
  }, avoid);

async function attempt(page, [a, b]) {
  await page.locator(`[data-card="${a}"]`).click();
  await page.locator(`[data-card="${b}"]`).click();
  await page.waitForFunction(() => window.__fmTest.state().busy === false, null, { timeout: 5000 });
  await page.waitForTimeout(80);
}

test('the card you just looked at is still the card you just looked at', async ({ page }) => {
  await page.goto(RIGGED);

  const [a, b] = await findMismatch(page);
  await page.locator(`[data-card="${a}"]`).click();
  await page.locator(`[data-card="${b}"]`).click();
  // Read what the player was shown, before the flip-back and the reshuffle.
  await page.waitForTimeout(220);
  const shownA = await fruitOf(page, a);
  const shownB = await fruitOf(page, b);
  await page.waitForFunction(() => window.__fmTest.state().busy === false, null, { timeout: 5000 });
  await page.waitForTimeout(120);

  expect(await fruitOf(page, a), 'the card just revealed changed').toBe(shownA);
  expect(await fruitOf(page, b), 'the card just revealed changed').toBe(shownB);
});

test('a card you stopped looking at quietly rots', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(RIGGED);

  const [a, b] = await findMismatch(page);
  await page.locator(`[data-card="${a}"]`).click();
  await page.locator(`[data-card="${b}"]`).click();
  await page.waitForTimeout(220);
  const remembered = await fruitOf(page, a);
  await page.waitForFunction(() => window.__fmTest.state().busy === false, null, { timeout: 5000 });
  await page.waitForTimeout(120);

  let rotted = false;
  for (let i = 0; i < 25 && !rotted; i += 1) {
    const pair = await findMismatchAvoiding(page, a);
    if (!pair) break;
    await attempt(page, pair);
    if ((await fruitOf(page, a)) !== remembered) rotted = true;
  }
  expect(rotted, 'a card the player abandoned never changed').toBe(true);
});

test('the reshuffle is still silent and invisible', async ({ page }) => {
  // Task 20's guarantees, unchanged by the cold-card gate.
  await page.goto(RIGGED);
  const grid = page.locator('[data-region="grid"]');

  const [a, b] = await findMismatch(page);
  await page.locator(`[data-card="${a}"]`).click();
  await page.locator(`[data-card="${b}"]`).click();
  await page.waitForFunction(() => window.__fmTest.state().busy === false, null, { timeout: 5000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.activeElement?.blur());

  const before = await grid.screenshot();
  await page.waitForTimeout(400);
  const after = await grid.screenshot();
  expect(Buffer.compare(before, after), 'the grid changed with no input').toBe(0);
});

test('the tally stays even as the board rots', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(RIGGED);

  for (let i = 0; i < 25; i += 1) {
    await attempt(page, await findMismatch(page));
    const tally = await page.evaluate(() => {
      const counts = {};
      for (const card of window.__fmTest.cards()) {
        if (card.state !== 'locked') counts[card.fruit] = (counts[card.fruit] ?? 0) + 1;
      }
      return counts;
    });
    for (const [fruit, count] of Object.entries(tally)) {
      expect(count % 2, `attempt ${i + 1}: ${fruit} count ${count} is odd`).toBe(0);
    }
  }
});
