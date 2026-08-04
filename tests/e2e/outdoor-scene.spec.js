import { test, expect } from '@playwright/test';

// SPEC.md §3.6. The stall stands outdoors on the outskirts of a farm. The
// backdrop is one layer behind the five stall regions, it is the only thing
// exempt from §2.10's warm-tone rule, and it must never compete with the 36
// sprites the player actually has to read.

const BACKDROP = '[data-backdrop]';

/** Computed color string to HSL, with h in degrees and s/l in 0..1. */
function toHsl(color) {
  const [r, g, b] = color.match(/[\d.]+/g).map(Number).slice(0, 3).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

/**
 * Sample the backdrop's painted color down a vertical line, in a column beside
 * the stall so only the environment is read.
 *
 * Hit tests the real layout rather than reading declared CSS, so it measures
 * what is actually in front of the player at each height. The scene's bands are
 * separate elements carrying solid `background-color` values precisely so this
 * can work: a gradient has no single computed color to report.
 */
async function sampleColumn(page, samples = 24) {
  return page.evaluate(async (count) => {
    /** Nearest ancestor that actually paints a background. */
    const painted = (el) => {
      let node = el;
      while (node && node !== document.documentElement) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        node = node.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    };

    const stall = document.querySelector('.stall').getBoundingClientRect();
    // A column beside the stall where the backdrop is unobstructed, falling
    // back to the far edge on narrow viewports.
    const x = stall.left > 24 ? Math.max(4, stall.left / 2) : 4;
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const ratio = (i + 0.5) / count;
      const y = ratio * window.innerHeight;
      const el = document.elementFromPoint(x, y);
      out.push({ y: Math.round(y), ratio, color: el ? painted(el) : 'rgba(0, 0, 0, 0)' });
    }
    return out;
  }, samples);
}

test('the backdrop exists and is not a stall region', async ({ page }) => {
  // One layer, one exemption. If the backdrop were a data-region, §2.10's
  // warm-tone guard would need widening, and that guard is what carries §2.10.
  await page.goto('/');
  await expect(page.locator(BACKDROP)).toHaveCount(1);
  expect(await page.locator(`${BACKDROP}[data-region]`).count()).toBe(0);
  expect(await page.locator(`${BACKDROP} [data-region]`).count()).toBe(0);
});

test('the backdrop is behind the stall, not in it', async ({ page }) => {
  // The stall has to read as an object standing in a place.
  await page.goto('/');
  const behind = await page.evaluate(() => {
    const backdrop = document.querySelector('[data-backdrop]');
    const stall = document.querySelector('.stall');
    return backdrop.compareDocumentPosition(stall) & Node.DOCUMENT_POSITION_FOLLOWING
      ? true
      : Number(getComputedStyle(backdrop).zIndex || 0) < Number(getComputedStyle(stall).zIndex || 0);
  });
  expect(behind).toBe(true);
  expect(await page.locator(`${BACKDROP} .stall`).count()).toBe(0);
});

test('the sky reads as sky', async ({ page }) => {
  await page.goto('/');
  const top = (await sampleColumn(page))[0];
  const { h, s, l } = toHsl(top.color);
  expect(h, `top of backdrop hue ${h.toFixed(0)} is not blue`).toBeGreaterThan(180);
  expect(h, `top of backdrop hue ${h.toFixed(0)} is not blue`).toBeLessThan(260);
  expect(s, 'sky is washed out').toBeGreaterThan(0.15);
  expect(l, 'sky is too dark').toBeGreaterThan(0.35);
  expect(l, 'sky is blown out').toBeLessThan(0.95);
});

test('a field horizon separates sky from ground', async ({ page }) => {
  // "Outskirts of a farm" as a measurable property: going down the backdrop
  // crosses from blue to green exactly once.
  await page.goto('/');
  const column = await sampleColumn(page, 40);
  const band = column.map(({ color, ratio }) => {
    const { h, s } = toHsl(color);
    if (s < 0.08) return 'neutral';
    if (h > 180 && h < 260) return 'sky';
    if (h > 60 && h <= 180) return 'field';
    return 'other';
  });

  expect(band.filter((b) => b === 'sky').length, 'no sky band').toBeGreaterThan(2);
  expect(band.filter((b) => b === 'field').length, 'no field band').toBeGreaterThan(2);

  const firstField = band.indexOf('field');
  const lastSky = band.lastIndexOf('sky');
  expect(lastSky, 'the field is not below the sky').toBeLessThan(firstField);
});

test('the backdrop is drawn, not fetched', async ({ page, baseURL }) => {
  // SPEC.md §3.6 and §11: CSS only. An external url() would also be refused by
  // the policy in §11.1, but this fails loudly instead of at runtime.
  //
  // Compared against baseURL, not page.url(): the first request fires while the
  // page is still about:blank, whose origin is "null".
  const origin = new URL(baseURL).origin;
  const external = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin) external.push(request.url());
  });
  await page.goto('/');
  await expect(page.locator(BACKDROP)).toHaveCount(1);
  const remote = await page.evaluate(() => {
    const found = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of rules) {
        const text = rule.cssText ?? '';
        if (/url\(\s*['"]?(https?:)?\/\//i.test(text)) found.push(text.slice(0, 80));
      }
    }
    return found;
  });
  expect(remote).toEqual([]);
  expect(external).toEqual([]);
});

test('the backdrop keeps its distance from the cards', async ({ page }) => {
  // The grid sits on its own opaque crate-slat background, so nothing from the
  // scene shows through behind the sprites the player has to read.
  await page.goto('/');
  // Anchored to the backdrop existing, or this asserts nothing until it does.
  await expect(page.locator(BACKDROP)).toHaveCount(1);
  const grid = await page.evaluate(() => {
    const el = document.querySelector('[data-region="grid"]');
    const bg = getComputedStyle(el).backgroundColor;
    const alpha = bg.startsWith('rgba') ? Number(bg.split(',')[3]) : 1;
    return { bg, alpha };
  });
  expect(grid.alpha).toBe(1);
});

test('the scene does not push the game off the screen', async ({ page }) => {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator(BACKDROP)).toHaveCount(1);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal scroll at ${width}px`).toBeLessThanOrEqual(0);

    expect(await page.locator('[data-card]').count()).toBe(36);
    const offscreen = await page.evaluate(() => {
      const h = window.innerHeight;
      return [...document.querySelectorAll('[data-card]')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > h || r.top < 0;
      }).length;
    });
    expect(offscreen, `cards off screen at ${width}px`).toBe(0);
  }
});

test('the sun is a flat disc', async ({ page }) => {
  // SPEC.md §3.6: no gradient, no glow. A soft radial sun would break the pixel
  // idiom §2.9 and §3.2 hold everything else to.
  await page.goto('/');
  const sun = await page.evaluate(() => {
    const el = document.querySelector('[data-sun]');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      radius: cs.borderRadius,
      shadow: cs.boxShadow,
      filter: cs.filter,
      bg: cs.backgroundColor,
    };
  });
  expect(sun, 'no sun in the scene').not.toBeNull();
  expect(sun.shadow === 'none' || sun.shadow === '', 'the sun has a glow').toBe(true);
  expect(sun.filter === 'none' || sun.filter === '', 'the sun is filtered').toBe(true);
});

test('ambient motion stops under reduced motion', async ({ page }) => {
  // The opposite of the card flip, which §9 requires be shortened and never
  // removed. The flip hides the rig; a drifting cloud hides nothing, so there
  // is no reason to keep it moving for someone who asked for stillness.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator(BACKDROP)).toHaveCount(1);
  const moving = await page.evaluate(() =>
    [...document.querySelectorAll('[data-backdrop], [data-backdrop] *')].filter((el) => {
      const cs = getComputedStyle(el);
      return cs.animationName !== 'none' && cs.animationPlayState === 'running';
    }).length,
  );
  expect(moving, 'scenery still animating under reduced motion').toBe(0);
});

test('the scene leaks nothing over a long session', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?fm-test=1&fm-rig=0');
  await expect(page.locator(BACKDROP)).toHaveCount(1);
  const measure = () =>
    page.evaluate(() => ({
      nodes: document.querySelectorAll('*').length,
      backdropNodes: document.querySelectorAll('[data-backdrop] *').length,
    }));

  const before = await measure();
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
    await page.waitForTimeout(150);
  }
  expect(await measure()).toEqual(before);
});
