import { test, expect } from '@playwright/test';

// SPEC.md §7.2 preference 1, stated the way the player experiences it: the rig
// keeps showing them a fruit they just saw somewhere else, so they always think
// they know where the twin is.

const RIGGED = '/?fm-test=1&fm-rig=0';

const cards = (page) => page.evaluate(() => window.__fmTest.cards());

const fruitOf = (page, id) =>
  page.evaluate((cardId) => window.__fmTest.cards().find((c) => c.id === cardId).fruit, id);

const matchCount = (page) => page.evaluate(() => window.__fmTest.state().matches);

async function settle(page) {
  await page.waitForFunction(() => window.__fmTest.state().busy === false, null, { timeout: 5000 });
  await page.waitForTimeout(80);
}

test('the bait lands on most attempts', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(RIGGED);

  let baited = 0;
  let total = 0;

  for (let i = 0; i < 26; i += 1) {
    const board = await cards(page);
    const down = board.filter((c) => c.state === 'down');
    // Rotate the first card. Picking down[0] every time makes the player's
    // recent history collapse to a single card, and the one fruit it holds is
    // the one exclusion 1 forbids, so there is never anything left to bait
    // with. That is a degenerate player, not a degenerate rig.
    const first = down[i % down.length];
    const second = down.find((c) => c.fruit !== first.fruit && c.id !== first.id);
    if (!second) break;

    // What the player has been shown lately, other than on the card about to
    // turn over, and minus the fruit exclusion 1 permanently forbids.
    const remembered = new Set(
      board
        .filter((c) => c.lastShown && c.id !== second.id && c.lastShown !== first.fruit)
        .map((c) => c.lastShown),
    );

    await page.locator(`[data-card="${first.id}"]`).click();
    await page.locator(`[data-card="${second.id}"]`).click();
    await page.waitForTimeout(220);

    const shown = await fruitOf(page, second.id);
    if (remembered.size > 0) {
      total += 1;
      if (remembered.has(shown)) baited += 1;
    }

    await settle(page);
  }

  expect(total, 'never had a reveal history to bait with').toBeGreaterThan(8);
  // A preference, not a rule, so this is a rate. It is deliberately below 1:
  // dangling a remembered fruit on literally every failure is a pattern, and a
  // pattern is a tell.
  expect(baited / total, `bait landed on ${baited} of ${total}`).toBeGreaterThan(0.4);
});

test('chasing the bait almost always fails', async ({ page }) => {
  // The bait makes the dangled fruit genuinely present on the board, so the
  // twin the player goes looking for really is there. Chasing it is therefore
  // an attempt on a true pair, which SPEC.md §7.4 denies at the rigged rate
  // rather than always. The trap is a trap almost every time, which is the
  // point: an absolute never would be the statistical tell §7.4 exists to fix.
  test.setTimeout(240_000);
  await page.goto(RIGGED);

  let chases = 0;
  let caught = 0;

  for (let i = 0; i < 18; i += 1) {
    const board = await cards(page);
    const down = board.filter((c) => c.state === 'down');
    const first = down[i % down.length];
    const second = down.find((c) => c.fruit !== first.fruit && c.id !== first.id);
    if (!second) break;

    await page.locator(`[data-card="${first.id}"]`).click();
    await page.locator(`[data-card="${second.id}"]`).click();
    await page.waitForTimeout(220);
    const dangled = await fruitOf(page, second.id);
    await settle(page);

    // Go and get it, the way a player would.
    const after = await cards(page);
    const twin = after.find(
      (c) => c.state === 'down' && c.fruit === dangled && c.id !== second.id,
    );
    if (!twin) continue;

    const before = await matchCount(page);
    await page.locator(`[data-card="${second.id}"]`).click();
    await page.locator(`[data-card="${twin.id}"]`).click();
    await settle(page);
    chases += 1;
    if ((await matchCount(page)) > before) caught += 1;
  }

  expect(chases, 'never got to chase the bait').toBeGreaterThan(5);
  // A loose bound on purpose. This is a browser-speed sample of eight or so
  // chases against a grant chance in the low teens of a percent, so the noise
  // is larger than the signal at this sample size. The precise bound on the
  // grant rate is asserted deterministically over thousands of draws in
  // tests/unit/asymptotic-wall.test.js; what this test is for is that a real
  // player, chasing real bait through a real browser, mostly does not get it.
  expect(caught / chases, `caught ${caught} of ${chases} chases`).toBeLessThan(0.5);
});
