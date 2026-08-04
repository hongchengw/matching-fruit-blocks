import { test, expect } from '@playwright/test';

// SPEC.md §2.5, §6.5 and §7.3. The board holds still until the rig arms, so a
// player's memory is worth something for the first `rigLevel` matches.
//
// Nothing here asserted anything before task 24: `the honest phase is genuinely
// winnable` looks up a fresh pair before every attempt, so it passes happily on
// a board that reshuffles under it. Winnable and memorable are different
// properties and only the first one was ever tested.

/** Every unmatched card's identity, keyed by id, as the board's fingerprint. */
const fingerprint = (page) =>
  page.evaluate(() =>
    window.__fmTest
      .cards()
      .filter((c) => c.state !== 'locked')
      .map((c) => `${c.id}:${c.fruit}`)
      .join(),
  );

/** Two face-down cards of different fruits, so the attempt always fails. */
const findMismatch = (page) =>
  page.evaluate(() => {
    const down = window.__fmTest.cards().filter((c) => c.state === 'down');
    const first = down[0];
    return [first.id, down.find((c) => c.fruit !== first.fruit).id];
  });

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

test('the honest board holds still across a failed attempt', async ({ page }) => {
  await page.goto('/?fm-test=1');
  expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(false);

  const before = await fingerprint(page);
  await attempt(page, await findMismatch(page));
  expect(await fingerprint(page), 'the honest board moved after a miss').toBe(before);
});

test('the honest board holds still for the whole honest phase', async ({ page }) => {
  // A single-attempt check would pass an implementation that reshuffles every
  // other time, or only once the second card has been seen.
  test.setTimeout(90_000);
  await page.goto('/?fm-test=1');

  for (let i = 0; i < 6; i += 1) {
    const before = await fingerprint(page);
    await attempt(page, await findMismatch(page));
    expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(false);
    expect(await fingerprint(page), `board moved after miss ${i + 1}`).toBe(before);
  }
});

test('memory works while the game is honest', async ({ page }) => {
  // The property as the player experiences it, rather than as the state stores
  // it: look at a card, fail an attempt, look again, see the same thing.
  await page.goto('/?fm-test=1');

  // Sampled across the whole board rather than on one card. A reshuffle can
  // leave any single card where it was by chance, so a one-card check is a
  // coin flip rather than a test.
  const remembered = await page.evaluate(() =>
    window.__fmTest.cards().map((c) => [c.id, c.fruit]),
  );

  await attempt(page, await findMismatch(page));

  const nowShows = await page.evaluate(() => {
    const map = {};
    for (const c of window.__fmTest.cards()) map[c.id] = c.fruit;
    return map;
  });
  const moved = remembered.filter(([id, fruit]) => nowShows[id] !== fruit).map(([id]) => id);
  expect(moved, `cards ${moved.join(', ')} changed under the player`).toEqual([]);
});

test('matched pairs still lock while the board is stable', async ({ page }) => {
  // A gate that froze the whole board rather than just the reshuffle would
  // still pass the tests above. Play a real match and require it to resolve.
  await page.goto('/?fm-test=1');
  const pair = await findPair(page);
  await attempt(page, pair);
  expect(await page.evaluate(() => window.__fmTest.state().matches)).toBe(1);
  expect(await page.locator('[data-card][data-state="locked"]').count()).toBe(2);
});

test('the reshuffle resumes the moment the rig arms', async ({ page }) => {
  // The gate must not disable the reshuffle outright. The rigged phase depends
  // on it: without it the reroll leaves odd fruit counts on the board.
  test.setTimeout(120_000);
  await page.goto('/?fm-test=1');

  for (let i = 0; i < 5; i += 1) {
    const pair = await findPair(page);
    expect(pair, `honest match ${i + 1} should be available`).not.toBeNull();
    await attempt(page, pair);
  }
  expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(true);

  const before = await fingerprint(page);
  await attempt(page, await findMismatch(page));
  expect(await fingerprint(page), 'the rigged board did not move').not.toBe(before);
});

test('the gate follows rigLevel, not the number five', async ({ page }) => {
  // The condition is `rigged`, never a hardcoded threshold.
  test.setTimeout(90_000);
  await page.goto('/?fm-test=1&fm-rig=2');

  for (let i = 0; i < 2; i += 1) {
    const before = await fingerprint(page);
    await attempt(page, await findMismatch(page));
    expect(await fingerprint(page), `board moved before the rig at miss ${i + 1}`).toBe(before);
    const pair = await findPair(page);
    await attempt(page, pair);
  }

  expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(true);
  const before = await fingerprint(page);
  await attempt(page, await findMismatch(page));
  expect(await fingerprint(page), 'the board did not move once rigged at 2').not.toBe(before);
});

test('an honest mismatch still takes the full 1000ms', async ({ page }) => {
  // Skipping work on the honest path must not make the honest path faster.
  // Timing is a detection channel (SPEC.md §6.5).
  test.setTimeout(90_000);
  await page.goto('/?fm-test=1');

  const timeAttempt = async () => {
    const [a, b] = await findMismatch(page);
    const started = await page.evaluate(() => performance.now());
    await page.locator(`[data-card="${a}"]`).click();
    await page.locator(`[data-card="${b}"]`).click();
    await page.waitForFunction(() => window.__fmTest.state().busy === false, null, {
      timeout: 5000,
    });
    const ended = await page.evaluate(() => performance.now());
    await page.waitForTimeout(120);
    return ended - started;
  };

  const honest = await timeAttempt();
  expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(false);
  expect(honest, `honest mismatch resolved in ${Math.round(honest)}ms`).toBeGreaterThan(950);
});
