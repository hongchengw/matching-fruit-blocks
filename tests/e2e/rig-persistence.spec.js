import { test, expect } from '@playwright/test';

// SPEC.md §2.7, §2.8, §8, and the persistence invariant in §10.3.
//
// This file replaces compounding-curse.spec.js. Reset used to decrement
// `rigLevel` until the honest phase vanished entirely, and five of that file's
// six tests asserted exactly that. Task 25 removed the behavior at the owner's
// direction, so those tests went with it: a deliberately removed behavior is
// the only acceptable reason to delete a passing test.
//
// What survives is what still holds. The rig is per round now, so the questions
// are whether the threshold stays put, whether it survives a reload, whether a
// new round really does restore the honest phase, and whether the wall is still
// unavoidable inside a round.

const TEST_PAGE = '/?fm-test=1';

const rigLevel = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('fm.state') ?? '{}').rigLevel);

const reset = (page) => page.locator('[data-control="reset"]').click();

const findPair = (page) =>
  page.evaluate(() => {
    const down = window.__fmTest.cards().filter((c) => c.state === 'down');
    for (let i = 0; i < down.length; i += 1) {
      for (let j = i + 1; j < down.length; j += 1) {
        if (down[i].fruit === down[j].fruit) return [down[i].id, down[j].id];
      }
    }
    return null;
  });

async function attempt(page, [a, b]) {
  await page.locator(`[data-card="${a}"]`).click();
  await page.locator(`[data-card="${b}"]`).click();
  await page.waitForFunction(() => window.__fmTest.state().busy === false, null, {
    timeout: 5000,
  });
  await page.waitForTimeout(120);
}

/** Play to the wall: `rigLevel` honest matches, after which nothing matches. */
async function playToTheWall(page) {
  for (let i = 0; i < 5; i += 1) {
    const pair = await findPair(page);
    expect(pair, `honest match ${i + 1} should be available`).not.toBeNull();
    await attempt(page, pair);
  }
  expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(true);
}

test('reset leaves the threshold alone', async ({ page }) => {
  await page.goto(TEST_PAGE);
  expect(await rigLevel(page)).toBe(5);

  for (let i = 0; i < 8; i += 1) {
    await reset(page);
    expect(await rigLevel(page), `rigLevel moved on reset ${i + 1}`).toBe(5);
  }
});

test('the honest phase returns after a reset', async ({ page }) => {
  // The whole point of the task. Play to the wall, start a new round, and the
  // next true pair matches again.
  test.setTimeout(120_000);
  await page.goto(TEST_PAGE);
  await playToTheWall(page);

  await reset(page);
  expect(await page.evaluate(() => window.__fmTest.state().matches)).toBe(0);
  expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(false);

  await attempt(page, await findPair(page));
  expect(await page.evaluate(() => window.__fmTest.state().matches)).toBe(1);
  expect(await page.locator('[data-card][data-state="locked"]').count()).toBe(2);
});

test('the wall is still there after a reset', async ({ page }) => {
  // Restoring the honest phase must not remove the rig. The new round hits the
  // same wall in the same place.
  test.setTimeout(180_000);
  await page.goto(TEST_PAGE);
  await playToTheWall(page);
  await reset(page);
  await playToTheWall(page);

  const pair = await findPair(page);
  await attempt(page, pair);
  expect(await page.evaluate(() => window.__fmTest.state().matches)).toBe(5);
  expect(await page.locator('[data-card][data-state="locked"]').count()).toBe(10);
});

test('the threshold survives a reload', async ({ page }) => {
  // The persistence channel from SPEC.md §10.3, in its new form: stable rather
  // than decaying.
  test.setTimeout(120_000);
  await page.goto(TEST_PAGE);
  await playToTheWall(page);

  await page.reload();
  expect(await rigLevel(page)).toBe(5);
  // A reload deals a fresh board and does not persist progress (§8), so the
  // honest phase is available again and the threshold is unchanged.
  expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(false);
  await attempt(page, await findPair(page));
  expect(await page.evaluate(() => window.__fmTest.state().matches)).toBe(1);
});

test('the threshold survives a browser restart', async ({ browser, baseURL }) => {
  // localStorage, not session or in-memory storage.
  const first = await browser.newContext();
  const page = await first.newPage();
  await page.goto(`${baseURL}/?fm-test=1`);
  await reset(page);
  expect(await rigLevel(page)).toBe(5);
  const state = await first.storageState();
  await first.close();

  const second = await browser.newContext({ storageState: state });
  const revived = await second.newPage();
  await revived.goto(`${baseURL}/?fm-test=1`);
  expect(await rigLevel(revived)).toBe(5);
  expect(await revived.evaluate(() => window.__fmTest.state().rigged)).toBe(false);
  await second.close();
});

test('nothing but a new round escapes the rig', async ({ page }) => {
  // A standing guard for SPEC.md §2.8, with one documented exception. Once the
  // rig has armed, no input inside the round lifts it.
  test.setTimeout(120_000);
  await page.goto(TEST_PAGE);
  await playToTheWall(page);

  // Every interactive element except the reset button, which is the one control
  // allowed to start a new round.
  const controls = page.locator('button:not([data-control="reset"]), a, input, [tabindex]');
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    await controls
      .nth(i)
      .click({ force: true, timeout: 2000 })
      .catch(() => {});
  }

  // The signboard, hammered, and the cheat codes someone will inevitably try.
  const signboard = page.locator('[data-region="signboard"]');
  for (let i = 0; i < 10; i += 1) await signboard.click({ force: true });
  await page.keyboard.press('Escape');
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'KeyB', 'KeyA']) {
    await page.keyboard.press(key);
  }
  await page.keyboard.type('reset');

  expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(true);
  expect(await page.evaluate(() => window.__fmTest.state().matches)).toBe(5);
  expect(await rigLevel(page)).toBe(5);
});

test('resetting does not announce itself', async ({ page }) => {
  // Survives task 25 and matters more than it did, not less. The game must not
  // start explaining itself just because it got kinder.
  await page.goto('/');
  const before = await page.locator('.stall').innerText();

  await reset(page);
  await page.waitForTimeout(200);
  const after = await page.locator('.stall').innerText();

  expect(after).toBe(before);
  expect(after.toLowerCase()).not.toMatch(/harder|again|sure|warning|level|curse|fresh start/);
  expect(await page.locator('dialog, [role="alert"], [role="dialog"]').count()).toBe(0);
});
