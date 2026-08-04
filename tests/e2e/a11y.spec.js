import { test, expect } from '@playwright/test';

// SPEC.md §9. Every interaction has to work by touch and by keyboard, and the
// reduced-motion path has to stay playable without opening the visual channel.

const TEST_PAGE = '/?fm-test=1';

/*
 * The contrast math runs here, in the test process, not in the page.
 *
 * It used to be a source string `eval`ed inside `page.evaluate`, because an
 * evaluated function is serialized and sent to the page, where nothing from
 * this module exists. But SPEC.md §11.1 puts a Content-Security-Policy on the
 * page, and `eval` is precisely what that policy refuses, so a test that needs
 * it is testing a page that does not ship.
 *
 * It does not need to be there at all. The page's job is to report the colors
 * it computed; comparing them is arithmetic. Only `backdrop` below has to run
 * in the page, since it walks the DOM.
 */

const channel = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

const luminance = (rgb) => {
  const [r, g, b] = rgb.match(/[\d.]+/g).map(Number);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** WCAG contrast ratio between two computed color strings. */
const ratio = (a, b) => {
  const [hi, lo] = luminance(a) > luminance(b) ? [a, b] : [b, a];
  return (luminance(hi) + 0.05) / (luminance(lo) + 0.05);
};

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

test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 800 } });

  test('plays fully by touch', async ({ page }) => {
    await page.goto('/?fm-test=1&fm-rig=999');

    const [a, b] = await findPair(page);
    await page.locator(`[data-card="${a}"]`).tap();
    await page.locator(`[data-card="${b}"]`).tap();
    await expect(page.locator(`[data-card="${a}"]`)).toHaveAttribute('data-state', 'locked');

    const [c, d] = await page.evaluate(() => {
      const down = window.__fmTest.cards().filter((x) => x.state === 'down');
      const first = down[0];
      return [first.id, down.find((x) => x.fruit !== first.fruit).id];
    });
    await page.locator(`[data-card="${c}"]`).tap();
    await page.locator(`[data-card="${d}"]`).tap();
    await expect(page.locator(`[data-card="${c}"]`)).toHaveAttribute('data-state', 'down', {
      timeout: 3000,
    });
  });

  test('suppresses double-tap zoom on every control', async ({ page }) => {
    await page.goto('/');
    const values = await page.evaluate(() =>
      [...document.querySelectorAll('button, [data-card]')].map(
        (el) => getComputedStyle(el).touchAction,
      ),
    );
    expect(values.length).toBeGreaterThan(36);
    expect(values.every((v) => v === 'manipulation')).toBe(true);
  });
});

test('exposes no hover-only affordance', async ({ page }) => {
  // Every :hover rule needs a :focus or :active counterpart, or the state it
  // communicates is invisible to touch and keyboard users.
  await page.goto('/');
  const orphans = await page.evaluate(() => {
    const selectors = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of rules) {
        if (rule.selectorText) selectors.push(rule.selectorText);
      }
    }
    const hovers = selectors.filter((s) => s.includes(':hover'));
    return hovers.filter((s) => {
      const base = s.replaceAll(':hover', '');
      return !selectors.some(
        (other) =>
          other !== s &&
          (other.replaceAll(':focus-visible', '').replaceAll(':focus', '') === base ||
            other.replaceAll(':active', '') === base),
      );
    });
  });
  expect(orphans).toEqual([]);
});

test('is fully keyboard playable', async ({ page }) => {
  await page.goto('/?fm-test=1&fm-rig=999');

  // Tab reaches the cards at all.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const reached = await page.evaluate(() => document.activeElement?.dataset?.card !== undefined);
  expect(reached).toBe(true);

  // A full match, made without a mouse: Enter on one card, Space on its twin.
  const [a, b] = await findPair(page);
  await page.locator(`[data-card="${a}"]`).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(`[data-card="${a}"]`)).toHaveAttribute('data-state', 'up');

  await page.locator(`[data-card="${b}"]`).focus();
  await page.keyboard.press('Space');
  await expect(page.locator(`[data-card="${b}"]`)).toHaveAttribute('data-state', 'locked');
  expect(await page.evaluate(() => window.__fmTest.state().matches)).toBe(1);
});

test('always shows where the focus is', async ({ page }) => {
  await page.goto('/');
  const measured = await page.evaluate(() => {
    /** Nearest ancestor that actually paints a background. */
    const backdrop = (el) => {
      let node = el;
      while (node && node !== document.documentElement) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        node = node.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    };

    const out = [];
    for (const el of document.querySelectorAll('button')) {
      el.focus();
      const cs = getComputedStyle(el);
      out.push({
        tag: el.className,
        style: cs.outlineStyle,
        width: parseFloat(cs.outlineWidth),
        outline: cs.outlineColor,
        behind: backdrop(el),
      });
    }
    return out;
  });
  const results = measured.map((m) => ({ ...m, contrast: ratio(m.outline, m.behind) }));

  expect(results.length).toBeGreaterThan(36);
  for (const result of results) {
    expect(result.style, `${result.tag} focus outline`).not.toBe('none');
    expect(result.width, `${result.tag} focus width`).toBeGreaterThanOrEqual(2);
    // WCAG 2.2 non-text contrast for a focus indicator.
    expect(result.contrast, `${result.tag} focus contrast`).toBeGreaterThanOrEqual(3);
  }
});

test('meets WCAG AA text contrast', async ({ page }) => {
  await page.goto('/');
  const sampled = await page.evaluate(() => {
    /** Nearest ancestor that actually paints a background. */
    const backdrop = (el) => {
      let node = el;
      while (node && node !== document.documentElement) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        node = node.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    };

    const targets = [
      ['scoreboard digits', '[data-readout="matches"]'],
      ['score digits', '[data-readout="score"]'],
      ['mute button', '[data-control="mute"]'],
      ['reset button', '[data-control="reset"]'],
      ['price tag', '.price-tag'],
      ['title', '.signboard__title'],
    ];
    return targets.map(([name, selector]) => {
      const el = document.querySelector(selector);
      const cs = getComputedStyle(el);
      return {
        name,
        size: parseFloat(cs.fontSize),
        bold: Number(cs.fontWeight) >= 700,
        ink: cs.color,
        behind: backdrop(el),
      };
    });
  });
  const measured = sampled.map((s) => ({ ...s, contrast: ratio(s.ink, s.behind) }));

  for (const item of measured) {
    // AA: 3:1 for large text (18.66px bold or 24px), 4.5:1 otherwise.
    const large = item.size >= 24 || (item.bold && item.size >= 18.66);
    const required = large ? 3 : 4.5;
    expect(item.contrast, `${item.name} contrast ${item.contrast.toFixed(2)}`).toBeGreaterThanOrEqual(
      required,
    );
  }
});

test('plays through the phase boundary under reduced motion', async ({ page }) => {
  // The §9 warning verified in a real playthrough: the flip is shortened, never
  // removed, so the rig still has somewhere to hide.
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(TEST_PAGE);

  for (let i = 0; i < 5; i += 1) {
    const pair = await findPair(page);
    await page.locator(`[data-card="${pair[0]}"]`).click();
    await page.locator(`[data-card="${pair[1]}"]`).click();
    await page.waitForFunction(() => window.__fmTest.state().busy === false);
    // The lock releases while the cards are still rotating back. Sampling the
    // next flip through that tail would read the previous attempt's face.
    await page.waitForTimeout(250);
  }
  expect(await page.locator('[data-card][data-state="locked"]').count()).toBe(10);
  expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(true);

  // Still playable, and still hidden.
  for (let i = 0; i < 3; i += 1) {
    const [a, b] = await findPair(page);
    const capture = await page.evaluate(
      async ({ a, b }) => {
        const { drawSprite } = await import('/js/sprites.js');
        const signature = (canvas) =>
          canvas.getContext('2d').getImageData(0, 0, 16, 16).data.join(',');

        document.querySelector(`[data-card="${a}"]`).click();
        const element = document.querySelector(`[data-card="${b}"]`);
        const inner = element.querySelector('.card__inner');
        const canvas = element.querySelector('.card__face--front canvas');

        const frames = [];
        let running = true;
        const sample = () => {
          const m = getComputedStyle(inner).transform;
          const cos = m.startsWith('matrix') ? Number(m.slice(m.indexOf('(') + 1).split(',')[0]) : 1;
          frames.push({ cos, sig: signature(canvas) });
          if (running) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
        element.click();
        // Observed rather than timed: the reduced-motion flip is 80ms, and a
        // fixed window can miss it entirely on a loaded machine.
        const deadline = performance.now() + 2000;
        while (performance.now() < deadline && !frames.some((f) => f.cos < -0.9)) {
          await new Promise((r) => setTimeout(r, 16));
        }
        running = false;

        const committed = window.__fmTest.cards().find((c) => c.id === b).fruit;
        const reference = document.createElement('canvas');
        drawSprite(reference, committed);
        const final = signature(reference);
        return {
          readable: frames.filter((f) => f.cos < -0.35).length,
          leaked: frames.filter((f) => f.cos < -0.35 && f.sig !== final).length,
        };
      },
      { a, b },
    );

    expect(capture.readable).toBeGreaterThan(0);
    expect(capture.leaked).toBe(0);
    await page.waitForFunction(() => window.__fmTest.state().busy === false);
    // The lock releases while the cards are still rotating back. Sampling the
    // next flip through that tail would read the previous attempt's face.
    await page.waitForTimeout(250);
  }

  // Since SPEC.md §7.4 an attempt past the threshold may occasionally be
  // granted, so the assertion is that the wall holds rather than that nothing
  // moves. The rig staying hidden under reduced motion is what this test is
  // for, and that is asserted frame by frame above.
  const matches = await page.evaluate(() => window.__fmTest.state().matches);
  expect(matches).toBeGreaterThanOrEqual(5);
  expect(matches, 'the board was completed under reduced motion').toBeLessThan(18);
});
