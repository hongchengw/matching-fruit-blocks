import { test, expect } from '@playwright/test';

// SPEC.md §11.1. The no-network rule is a property of the shipped page, not a
// promise the source makes about itself, so it is asserted against the browser
// that enforces it.

/** Parse a policy string into directive -> source list. */
const directives = (policy) =>
  Object.fromEntries(
    policy
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...sources] = part.split(/\s+/);
        return [name, sources];
      }),
  );

const REQUIRED = {
  'default-src': "'self'",
  'connect-src': "'none'",
  'object-src': "'none'",
  'base-uri': "'none'",
};

test('ships a content security policy in the document itself', async ({ page }) => {
  // In the document rather than only in a response header, so the policy holds
  // however the app is served, including from a host that sends none.
  await page.goto('/');
  const policy = await page.getAttribute(
    'meta[http-equiv="Content-Security-Policy"]',
    'content',
  );
  expect(policy, 'no CSP meta tag in index.html').toBeTruthy();

  const found = directives(policy);
  for (const [name, source] of Object.entries(REQUIRED)) {
    expect(found[name], `${name} directive`).toEqual([source]);
  }
});

test('serves frame-ancestors as a real header', async ({ page }) => {
  // frame-ancestors is ignored inside a meta tag by specification, so it has to
  // arrive as a response header or it does not apply at all.
  const response = await page.goto('/');
  const header = response.headers()['content-security-policy'];
  expect(header, 'no CSP response header').toBeTruthy();
  expect(directives(header)['frame-ancestors']).toEqual(["'none'"]);
});

test('the policy refuses a network call', async ({ page }) => {
  // The directive that carries §11: no fetch, no beacon, no telemetry, and it
  // fails in the browser rather than in review.
  //
  // Asserting only that the fetch rejects proves nothing. A request to a third
  // party rejects anyway in this environment, on CORS or on there being no
  // route, so that version of this test passed with no policy at all. What
  // distinguishes refused-by-policy from merely-failed is the violation event,
  // which only the policy fires.
  await page.goto('/');
  const outcome = await page.evaluate(async () => {
    const violation = new Promise((resolve) => {
      document.addEventListener(
        'securitypolicyviolation',
        (event) => resolve(event.violatedDirective),
        { once: true },
      );
      setTimeout(() => resolve(null), 2000);
    });
    try {
      await fetch('https://example.com/collect');
    } catch {
      // Expected. Which error it is does not matter; the event does.
    }
    return violation;
  });
  expect(outcome, 'no connect-src violation was reported').toMatch(/connect-src/);
});

test('the game runs clean under the policy', async ({ page }) => {
  // A policy that breaks the app is worse than no policy. Play a full attempt
  // and require both that nothing was refused and that the board still paints.
  const violations = [];
  await page.addInitScript(() => {
    window.__violations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__violations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  page.on('console', (message) => {
    if (/content security policy/i.test(message.text())) violations.push(message.text());
  });

  await page.goto('/?fm-test=1&fm-rig=999');

  // Anchor the test to the policy actually being in force. Without this it
  // passes on a page that has no policy to violate, which makes it a test of
  // nothing until the tag lands.
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);

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

  // The sprite renderer sets canvas.style.imageRendering. Setting a property
  // through the CSSOM is outside style-src, but that is the kind of claim worth
  // checking rather than asserting, so the painted pixels are the check.
  const painted = await page.evaluate((id) => {
    const canvas = document.querySelector(`[data-card="${id}"] .card__face--front canvas`);
    const { data } = canvas.getContext('2d').getImageData(0, 0, 16, 16);
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) opaque += 1;
    return opaque;
  }, a);
  expect(painted, 'the matched card never painted its fruit').toBeGreaterThan(0);

  expect(await page.evaluate(() => window.__violations)).toEqual([]);
  expect(violations).toEqual([]);
});
