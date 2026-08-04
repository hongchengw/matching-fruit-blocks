import { test, expect } from '@playwright/test';

// SPEC.md §3.4. The face-down grid varies so it reads as a stocked stall rather
// than a tiled texture, and the variation belongs to the slot rather than the
// card, so it cannot be used to follow a card through a reshuffle.

const slotLooks = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-card]')].map((el) => {
      const back = el.querySelector('.card__face--back');
      const cs = getComputedStyle(back);
      return [cs.backgroundColor, cs.backgroundImage, cs.backgroundSize, cs.backgroundPosition].join(
        '|',
      );
    }),
  );

test('the back sprite is still one sprite', async ({ page }) => {
  // Task 10's guarantee, at the rendering level. The variation is in the slot
  // around the sprite, never in the sprite.
  await page.goto('/');
  const signatures = await page.evaluate(() =>
    [...document.querySelectorAll('[data-card] .card__face--back canvas')].map((c) =>
      c.getContext('2d').getImageData(0, 0, 16, 16).data.join(','),
    ),
  );
  expect(signatures).toHaveLength(36);
  expect(new Set(signatures).size, 'the card back is not one sprite any more').toBe(1);
});

test('the grid is not uniform', async ({ page }) => {
  await page.goto('/');
  const looks = await slotLooks(page);
  expect(new Set(looks).size, 'every slot looks identical').toBeGreaterThan(1);
});

test('variation is bound to the slot, not the card', async ({ page }) => {
  // The test this file exists for. Force identities to move and require every
  // slot to look exactly as it did.
  test.setTimeout(120_000);
  await page.goto('/?fm-test=1&fm-rig=0');

  const before = await slotLooks(page);
  const identitiesBefore = await page.evaluate(() =>
    window.__fmTest.cards().map((c) => `${c.id}:${c.fruit}`).join(),
  );

  // Enough failed attempts that the board has genuinely churned.
  for (let i = 0; i < 12; i += 1) {
    const [a, b] = await page.evaluate(() => {
      const down = window.__fmTest.cards().filter((c) => c.state === 'down');
      const first = down[0];
      return [first.id, down.find((c) => c.fruit !== first.fruit).id];
    });
    await page.locator(`[data-card="${a}"]`).click();
    await page.locator(`[data-card="${b}"]`).click();
    await page.waitForFunction(() => window.__fmTest.state().busy === false, null, {
      timeout: 5000,
    });
    await page.waitForTimeout(80);
  }

  const identitiesAfter = await page.evaluate(() =>
    window.__fmTest.cards().map((c) => `${c.id}:${c.fruit}`).join(),
  );
  expect(identitiesAfter, 'the board never moved, so this proves nothing').not.toBe(
    identitiesBefore,
  );

  expect(await slotLooks(page), 'a slot changed appearance when identities moved').toEqual(before);
});

test('variation is subtle', async ({ page }) => {
  // Loud variation competes with the sprites, and §3.6 already forbids the
  // scenery doing that.
  await page.goto('/');
  const colors = await page.evaluate(() =>
    [...document.querySelectorAll('[data-card] .card__face--back')].map(
      (el) => getComputedStyle(el).backgroundColor,
    ),
  );
  const rgb = colors.map((c) => c.match(/\d+/g).slice(0, 3).map(Number));
  const channelSpread = [0, 1, 2].map((i) => {
    const values = rgb.map((c) => c[i]);
    return Math.max(...values) - Math.min(...values);
  });
  expect(Math.max(...channelSpread), 'slot variation is too loud').toBeLessThan(40);
});

test('a revealed card is unaffected', async ({ page }) => {
  // The fruit face must render identically in every slot, or the
  // sprite-distinctness suites stop meaning anything.
  await page.goto('/?fm-test=1&fm-rig=999');
  const faces = await page.evaluate(() =>
    [...document.querySelectorAll('[data-card] .card__face--front')].map((el) => {
      const cs = getComputedStyle(el);
      return [cs.backgroundColor, cs.backgroundImage].join('|');
    }),
  );
  expect(new Set(faces).size, 'the fruit face varies by slot').toBe(1);
});

test('locked cards still read as locked', async ({ page }) => {
  await page.goto('/?fm-test=1&fm-rig=999');
  const [a, b] = await page.evaluate(() => {
    const down = window.__fmTest.cards().filter((c) => c.state === 'down');
    for (let i = 0; i < down.length; i += 1) {
      for (let j = i + 1; j < down.length; j += 1) {
        if (down[i].fruit === down[j].fruit) return [down[i].id, down[j].id];
      }
    }
    return null;
  });
  await page.locator(`[data-card="${a}"]`).click();
  await page.locator(`[data-card="${b}"]`).click();
  await expect(page.locator(`[data-card="${a}"]`)).toHaveAttribute('data-state', 'locked');

  const borders = await page.evaluate((id) => {
    const el = document.querySelector(`[data-card="${id}"] .card__face--front`);
    const cs = getComputedStyle(el);
    return { top: cs.borderTopColor, bottom: cs.borderBottomColor };
  }, a);
  expect(borders.top).not.toBe(borders.bottom);
});

test('focus is still visible on every slot', async ({ page }) => {
  await page.goto('/');
  const widths = await page.evaluate(() =>
    [...document.querySelectorAll('[data-card]')].map((el) => {
      el.focus();
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
    }),
  );
  for (const { style, width } of widths) {
    expect(style).not.toBe('none');
    expect(width).toBeGreaterThanOrEqual(2);
  }
});
