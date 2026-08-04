import { test, expect } from '@playwright/test';

// SPEC.md §7.4 and the statistical channel in §10.3. The rigged match rate is
// nonzero and decaying, so counting proves nothing, and the last pair never
// matches, so the board is never cleared.

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
  await page.waitForFunction(() => window.__fmTest.state().busy === false, null, { timeout: 5000 });
  await page.waitForTimeout(80);
}

test('the counter crawls past the threshold and stalls short of the end', async ({ page }) => {
  // 80 attempts rather than the several hundred it takes to actually reach the
  // floor. At the spec's 1000ms flip-back that is already over a minute of real
  // waiting, and on headless WebKit the longer version ran past five minutes.
  // The floor itself, and the full decay to a single outstanding pair, are
  // asserted deterministically over hundreds of attempts in
  // tests/unit/asymptotic-wall.test.js. What needs a browser is that the
  // readout tracks it and that the wall holds in a real playthrough.
  test.setTimeout(300_000);
  await page.goto('/?fm-test=1&fm-rig=0');

  const readout = page.locator('[data-readout="matches"]');
  await expect(readout).toHaveText('MATCHES MADE: 0/18');

  for (let i = 0; i < 80; i += 1) {
    const pair = await findPair(page);
    if (!pair) break;
    await attempt(page, pair);
    const matches = await page.evaluate(() => window.__fmTest.state().matches);
    expect(matches, 'the board was cleared').toBeLessThan(18);
  }

  const matches = await page.evaluate(() => window.__fmTest.state().matches);
  // Nonzero: the channel is sealed. Short of 18: the game is still unwinnable.
  expect(matches, 'not one match landed in 80 rigged attempts').toBeGreaterThan(0);
  expect(matches).toBeLessThan(18);
  await expect(readout).toHaveText(`MATCHES MADE: ${matches}/18`);

  // At least two cards remain on the board, forever.
  expect(await page.locator('[data-card]:not([data-state="locked"])').count()).toBeGreaterThanOrEqual(
    2,
  );
});

test('a granted match is indistinguishable from an honest one', async ({ page }) => {
  // A "mercy" match that felt different would be a worse tell than the one
  // §7.4 exists to fix. Same cue shape, same lock, same timing.
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    window.__cues = [];
    const Real = window.AudioContext ?? window.webkitAudioContext;
    if (!Real) return;
    class Recording extends Real {
      createOscillator() {
        const osc = super.createOscillator();
        const entry = { freq: null, type: null };
        window.__cues.push(entry);
        const freq = osc.frequency;
        const original = freq.setValueAtTime.bind(freq);
        freq.setValueAtTime = (v, t) => {
          entry.freq = v;
          entry.type = osc.type;
          return original(v, t);
        };
        return osc;
      }
    }
    window.AudioContext = Recording;
    window.webkitAudioContext = Recording;
  });

  // An honest match first, to record what one sounds like.
  await page.goto('/?fm-test=1');
  await page.evaluate(() => {
    window.__cues.length = 0;
  });
  await attempt(page, await findPair(page));
  const honest = await page.evaluate(() =>
    window.__cues.filter((c) => c.freq !== null && c.freq >= 600).map((c) => `${c.type}:${c.freq}`),
  );

  // Then a granted one, deep in the rigged phase.
  await page.goto('/?fm-test=1&fm-rig=0');
  let granted = null;
  for (let i = 0; i < 120 && granted === null; i += 1) {
    const pair = await findPair(page);
    if (!pair) break;
    await page.evaluate(() => {
      window.__cues.length = 0;
    });
    const before = await page.evaluate(() => window.__fmTest.state().matches);
    await attempt(page, pair);
    const after = await page.evaluate(() => window.__fmTest.state().matches);
    if (after > before) {
      granted = await page.evaluate(() =>
        window.__cues
          .filter((c) => c.freq !== null && c.freq >= 600)
          .map((c) => `${c.type}:${c.freq}`),
      );
    }
  }

  test.skip(
    !(await page.evaluate(() => Boolean(window.AudioContext ?? window.webkitAudioContext))),
    'engine exposes no WebAudio to listen to',
  );
  expect(granted, 'no match was ever granted').not.toBeNull();
  expect(granted).toEqual(honest);
});

test('the tally invariant survives a granted match', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/?fm-test=1&fm-rig=0');

  for (let i = 0; i < 60; i += 1) {
    const pair = await findPair(page);
    if (!pair) break;
    await attempt(page, pair);
    const tally = await page.evaluate(() => {
      const counts = {};
      for (const card of window.__fmTest.cards()) {
        if (card.state !== 'locked') counts[card.fruit] = (counts[card.fruit] ?? 0) + 1;
      }
      return counts;
    });
    for (const [fruit, count] of Object.entries(tally)) {
      expect(count % 2, `attempt ${i + 1}: ${fruit} count ${count} is odd`).toBe(0);
    }
  }
});
