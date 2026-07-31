import { test, expect } from '@playwright/test';

// SPEC.md §2.1 (board), §2.3 (why the midpoint matters), §3.4 (card geometry),
// §9 (responsive and reduced motion).

const CARD = '[data-card]';

test('renders 36 cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(CARD)).toHaveCount(36);
});

test('grid is 6 by 6', async ({ page }) => {
  await page.goto('/');
  const tracks = await page.locator('[data-region="grid"]').evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
  );
  expect(tracks).toBe(6);

  // Six distinct rows of six.
  const rows = await page.evaluate(() => {
    const tops = [...document.querySelectorAll('[data-card]')].map(
      (el) => Math.round(el.getBoundingClientRect().y),
    );
    const counts = {};
    for (const t of tops) counts[t] = (counts[t] ?? 0) + 1;
    return Object.values(counts);
  });
  expect(rows).toHaveLength(6);
  expect(rows.every((n) => n === 6)).toBe(true);
});

test('cards are square', async ({ page }) => {
  await page.goto('/');
  const skew = await page.evaluate(() =>
    [...document.querySelectorAll('[data-card]')].map((el) => {
      const r = el.getBoundingClientRect();
      return Math.abs(r.width - r.height);
    }),
  );
  expect(Math.max(...skew)).toBeLessThanOrEqual(1);
});

test('no horizontal scroll at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('tap targets meet the minimum at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  const widths = await page.evaluate(() =>
    [...document.querySelectorAll('[data-card]')].map((el) => el.getBoundingClientRect().width),
  );
  expect(Math.min(...widths)).toBeGreaterThanOrEqual(40);
});

test('cards have a front and a back face', async ({ page }) => {
  await page.goto('/');
  const shape = await page.evaluate(() => {
    const card = document.querySelector('[data-card]');
    const inner = card.querySelector('.card__inner');
    const front = card.querySelector('.card__face--front');
    const back = card.querySelector('.card__face--back');
    return {
      hasInner: Boolean(inner),
      preserve3d: getComputedStyle(inner).transformStyle,
      frontBackface: getComputedStyle(front).backfaceVisibility,
      backBackface: getComputedStyle(back).backfaceVisibility,
    };
  });
  expect(shape.hasInner).toBe(true);
  expect(shape.preserve3d).toBe('preserve-3d');
  expect(shape.frontBackface).toBe('hidden');
  expect(shape.backBackface).toBe('hidden');
});

test('flip duration is 180ms', async ({ page }) => {
  // Load-bearing. Task 18 schedules the rigged identity swap at half this
  // number. If the duration drifts, the swap lands off-midpoint and the visual
  // detection channel reopens.
  await page.goto('/');
  const duration = await page.evaluate(
    () => getComputedStyle(document.querySelector('.card__inner')).transitionDuration,
  );
  expect(duration).toBe('0.18s');
});

test('flip duration is exposed as a custom property', async ({ page }) => {
  // Task 18 reads this rather than hardcoding 90ms.
  await page.goto('/');
  const value = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--fm-flip-ms').trim(),
  );
  expect(Number(value)).toBe(180);
});

test('flip uses rotateY', async ({ page }) => {
  await page.goto('/');
  const matrix = await page.evaluate(() => {
    const card = document.querySelector('[data-card]');
    card.dataset.state = 'up';
    const inner = card.querySelector('.card__inner');
    return getComputedStyle(inner).transform;
  });
  // A Y-axis rotation produces a 3D matrix, not a translate or an opacity fade.
  expect(matrix).toMatch(/^matrix3d\(/);
  const values = matrix.slice(9, -1).split(',').map(Number);
  expect(values[0]).toBeCloseTo(-1, 1); // cos(180deg)
});

test('card is unreadable at the flip midpoint', async ({ page }) => {
  // This is the hiding place task 18 depends on. Prove it exists before
  // anything relies on it.
  await page.goto('/');
  const width = await page.evaluate(async () => {
    const card = document.querySelector('[data-card]');
    const front = card.querySelector('.card__face--front');
    card.dataset.state = 'up';
    await new Promise((r) => setTimeout(r, 90));
    return front.getBoundingClientRect().width;
  });
  expect(width).toBeLessThan(4);
});

test('locked cards use the recessed bevel', async ({ page }) => {
  await page.goto('/');
  const borders = await page.evaluate(() => {
    const card = document.querySelector('[data-card]');
    card.dataset.state = 'locked';
    const cs = getComputedStyle(card.querySelector('.card__face--front'));
    const lum = (rgb) => {
      const [r, g, b] = rgb.match(/\d+/g).map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    return { top: lum(cs.borderTopColor), bottom: lum(cs.borderBottomColor) };
  });
  expect(borders.top).toBeLessThan(borders.bottom);
});

test('reduced motion still flips', async ({ page }) => {
  // SPEC.md §9: shorten the flip, never remove it. Removing the animation
  // leaves nowhere for the rigged swap to hide and exposes the trick.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const { duration, flipMs } = await page.evaluate(() => ({
    duration: getComputedStyle(document.querySelector('.card__inner')).transitionDuration,
    flipMs: Number(
      getComputedStyle(document.documentElement).getPropertyValue('--fm-flip-ms').trim(),
    ),
  }));
  const seconds = parseFloat(duration);
  expect(seconds).toBeGreaterThan(0);
  expect(seconds).toBeLessThan(0.18);
  // The custom property must shrink with it so the midpoint stays proportional
  // and task 18 needs no special case.
  expect(flipMs).toBeGreaterThan(0);
  expect(flipMs).toBeLessThan(180);
});

test('touch-action is manipulation', async ({ page }) => {
  await page.goto('/');
  const value = await page.evaluate(
    () => getComputedStyle(document.querySelector('[data-card]')).touchAction,
  );
  expect(value).toBe('manipulation');
});

test('cards are keyboard focusable with a visible indicator', async ({ page }) => {
  await page.goto('/');
  const focusable = await page.evaluate(
    () =>
      [...document.querySelectorAll('[data-card]')].every(
        (el) => el.tabIndex >= 0 || el.tagName === 'BUTTON',
      ),
  );
  expect(focusable).toBe(true);

  await page.locator(CARD).first().focus();
  const outline = await page.evaluate(() => {
    const cs = getComputedStyle(document.activeElement);
    return { style: cs.outlineStyle, width: cs.outlineWidth };
  });
  expect(outline.style).not.toBe('none');
  expect(parseFloat(outline.width)).toBeGreaterThan(0);
});
