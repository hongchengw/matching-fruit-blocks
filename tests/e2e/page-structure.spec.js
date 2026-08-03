import { test, expect } from '@playwright/test';

// SPEC.md §3.3 (stall anatomy), §3.4 (bevel geometry), §3.5 (typography),
// §11 (no build step, no runtime network requests).

const REGIONS = ['awning', 'signboard', 'scoreboard', 'grid', 'base'];

// Documented CSS custom properties. Later tasks read these rather than
// hardcoding hex values.
const COLOR_VARS = [
  '--fm-ink',
  '--fm-canvas',
  '--fm-wood',
  '--fm-wood-dark',
  '--fm-wood-light',
  '--fm-awning-a',
  '--fm-awning-b',
  '--fm-bevel-light',
  '--fm-bevel-dark',
  '--fm-lcd-bg',
  '--fm-lcd-on',
];

/** Relative luminance of an "rgb(r, g, b)" string. */
function luminance(rgb) {
  const [r, g, b] = rgb.match(/\d+/g).map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test('page loads without console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});

test('has the five stall regions', async ({ page }) => {
  await page.goto('/');
  for (const region of REGIONS) {
    await expect(page.locator(`[data-region="${region}"]`)).toHaveCount(1);
  }
});

test('regions appear in the spec document order', async ({ page }) => {
  await page.goto('/');
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('[data-region]')].map((el) => el.dataset.region),
  );
  expect(order).toEqual(REGIONS);
});

test('makes no network requests beyond same-origin app files', async ({ page }) => {
  // Enforces SPEC.md §3.5 and §11 before any later task can casually add a
  // Google Fonts link or a CDN script.
  const requests = [];
  page.on('request', (req) => requests.push(req.url()));
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(requests.length).toBeGreaterThan(0);
  for (const url of requests) {
    expect(url, `off-origin request: ${url}`).toMatch(/^http:\/\/localhost:4173\//);
    expect(url, `unexpected file type: ${url}`).toMatch(/(\/|\.html|\.css|\.js)$/);
  }
});

test('declares a monospace fallback', async ({ page }) => {
  await page.goto('/');
  const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(family.toLowerCase()).toMatch(/monospace\s*$/);
});

test('scoreboard text is uppercase and letter-spaced', async ({ page }) => {
  await page.goto('/');
  const style = await page.evaluate(() => {
    const el = document.querySelector('[data-region="scoreboard"]');
    const cs = getComputedStyle(el);
    return { transform: cs.textTransform, spacing: cs.letterSpacing };
  });
  expect(style.transform).toBe('uppercase');
  expect(style.spacing).not.toBe('normal');
  expect(parseFloat(style.spacing)).toBeGreaterThan(0);
});

test('bevel primitive renders raised', async ({ page }) => {
  // SPEC.md §3.4: light from the top left. Encoded here so later tasks cannot
  // silently flip it.
  await page.goto('/');
  const bevel = page.locator('.bevel').first();
  await expect(bevel).toBeAttached();
  const borders = await bevel.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      top: cs.borderTopColor,
      left: cs.borderLeftColor,
      bottom: cs.borderBottomColor,
      right: cs.borderRightColor,
    };
  });
  expect(luminance(borders.top)).toBeGreaterThan(luminance(borders.bottom));
  expect(luminance(borders.left)).toBeGreaterThan(luminance(borders.right));
});

test('bevel is 3px on all sides', async ({ page }) => {
  await page.goto('/');
  const widths = await page.locator('.bevel').first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return [
      cs.borderTopWidth,
      cs.borderRightWidth,
      cs.borderBottomWidth,
      cs.borderLeftWidth,
    ].map(parseFloat);
  });
  // Compared numerically with a sub-pixel tolerance. The declared width is
  // 3px, but Firefox reports it snapped to the device pixel grid (2.75px at
  // this scale factor), and the bevel being chunky and even on all four sides
  // is what the spec actually asks for.
  expect(widths).toHaveLength(4);
  for (const width of widths) {
    expect(width).toBeGreaterThan(2.5);
    expect(width).toBeLessThanOrEqual(3);
  }
  expect(new Set(widths).size).toBe(1);
});

test('recessed bevel inverts the raised one', async ({ page }) => {
  await page.goto('/');
  const borders = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'bevel bevel--recessed';
    document.body.append(probe);
    const cs = getComputedStyle(probe);
    const out = {
      top: cs.borderTopColor,
      left: cs.borderLeftColor,
      bottom: cs.borderBottomColor,
      right: cs.borderRightColor,
    };
    probe.remove();
    return out;
  });
  expect(luminance(borders.top)).toBeLessThan(luminance(borders.bottom));
  expect(luminance(borders.left)).toBeLessThan(luminance(borders.right));
});

test('color variables are defined', async ({ page }) => {
  await page.goto('/');
  const values = await page.evaluate((names) => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n).trim()]));
  }, COLOR_VARS);
  for (const name of COLOR_VARS) {
    expect(values[name], `${name} is not defined`).toMatch(/^#[0-9a-f]{3,8}$/i);
  }
});

test('scripts load as ES modules', async ({ page }) => {
  // SPEC.md §11 forbids a bundler, so the browser resolves the module graph.
  await page.goto('/');
  const types = await page.evaluate(() =>
    [...document.querySelectorAll('script')].map((s) => s.getAttribute('type')),
  );
  expect(types.length).toBeGreaterThan(0);
  for (const type of types) {
    expect(type).toBe('module');
  }
});
