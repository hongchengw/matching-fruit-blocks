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
  const matrix = await page.evaluate(async () => {
    const card = document.querySelector('[data-card]');
    const inner = card.querySelector('.card__inner');
    card.dataset.state = 'up';
    // Let the transition finish. Reading immediately returns the pre-transition
    // value, since the transition does not begin until the next frame.
    await new Promise((r) => setTimeout(r, 300));
    return getComputedStyle(inner).transform;
  });
  // A Y-axis rotation produces a 3D matrix, not a translate or an opacity fade.
  expect(matrix).toMatch(/^matrix3d\(/);
  const values = matrix.slice(9, -1).split(',').map(Number);
  expect(values[0]).toBeCloseTo(-1, 1); // cos(180deg)
});

/*
 * The three tests below together establish the hiding place task 18 depends on.
 *
 * Measuring the flip's exact midpoint from wall-clock time is not reliable: the
 * transition starts a frame after the style change, and the window where the
 * face is narrow enough to be unreadable is only a few milliseconds wide. The
 * underlying property is deterministic even though sampling it is not, so it is
 * tested directly instead: the geometry collapses when edge-on, the timing
 * function is linear, and a real flip is observed passing through that region.
 */

test('card is unreadable when edge-on', async ({ page }) => {
  await page.goto('/');
  const measured = await page.evaluate(() => {
    const card = document.querySelector('[data-card]');
    const inner = card.querySelector('.card__inner');
    const front = card.querySelector('.card__face--front');
    const full = card.getBoundingClientRect().width;
    inner.style.transition = 'none';
    inner.style.transform = 'rotateY(90deg)';
    const width = front.getBoundingClientRect().width;
    return { width, full };
  });
  expect(measured.full).toBeGreaterThan(20);
  expect(measured.width).toBeLessThan(4);
});

test('flip is linear so the midpoint is edge-on', async ({ page }) => {
  // With a linear curve, half the duration is exactly 90 degrees. An eased
  // curve would put the card somewhere else at the moment task 18 swaps.
  await page.goto('/');
  const easing = await page.evaluate(
    () => getComputedStyle(document.querySelector('.card__inner')).transitionTimingFunction,
  );
  expect(easing).toBe('linear');
});

test('a real flip passes through the edge-on region', async ({ page }) => {
  await page.goto('/');
  const cosines = await page.evaluate(async () => {
    // Stretch the flip for the duration of the measurement. Playwright's
    // headless WebKit delivers requestAnimationFrame roughly every 130ms here,
    // so a 180ms flip is one or two samples wide on that engine and cannot be
    // observed at all. Nothing about the mechanism changes: the same CSS
    // transition on the same property with the same linear curve, just slow
    // enough for a slow sampler to resolve. The shipped 180ms is asserted by
    // `flip duration is 180ms`; this test is about the shape of the rotation,
    // not its length.
    document.documentElement.style.setProperty('--fm-flip-ms', '2000');

    const card = document.querySelector('[data-card]');
    const inner = card.querySelector('.card__inner');
    const samples = [];
    let done = false;
    // Read the rotation out of the matrix rather than measuring the face's
    // projected width. WebKit does not foreshorten a preserve-3d child's
    // bounding rect the way Chromium and Firefox do, so the rect is not a
    // portable proxy for the angle. The matrix is the angle.
    const sample = () => {
      const m = getComputedStyle(inner).transform;
      if (m.startsWith('matrix')) {
        samples.push(Number(m.slice(m.indexOf('(') + 1).split(',')[0]));
      }
      if (!done) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    card.dataset.state = 'up';
    await new Promise((r) => setTimeout(r, 2400));
    done = true;
    return samples;
  });

  // The matrix's first component is cos(angle), so it is +1 face-on, 0 edge-on,
  // and -1 turned all the way round.
  //
  // This used to assert that some sampled frame landed within 0.35 of zero,
  // which asks the sampler to catch a window about 20ms wide in a 180ms flip.
  // At 60fps that is a single frame of margin, so one dropped frame failed the
  // test on Firefox and WebKit while the flip itself was perfectly correct.
  //
  // Proximity was only ever a proxy for the real property: that the rotation
  // *passes through* 90 degrees. Assert that directly. A positive sample
  // followed by a negative one means the cosine changed sign, and since the
  // sibling test pins the timing function to linear, the angle is continuous in
  // time and must therefore have been exactly 90 degrees in between. That is
  // the exact statement rather than an approximation of it, and where the
  // frames happen to land cannot affect it.
  const firstNegative = cosines.findIndex((cos) => cos < 0);
  expect(firstNegative, 'the flip never turned past edge-on').toBeGreaterThan(-1);
  expect(
    cosines.slice(0, firstNegative).some((cos) => cos > 0),
    'no frame was observed before the card turned past edge-on',
  ).toBe(true);

  // And it got there by rotating rather than jumping: intermediate angles were
  // actually on screen. Without this a card that snapped from 0 to 180 in one
  // frame would satisfy the sign change above.
  const intermediate = cosines.filter((cos) => Math.abs(cos) < 0.95).length;
  expect(intermediate, `only ${intermediate} intermediate frames`).toBeGreaterThan(3);
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
