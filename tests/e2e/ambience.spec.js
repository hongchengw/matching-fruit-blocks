import { test, expect } from '@playwright/test';

// SPEC.md §4.2, §4.3, §4.4 and §11. The bed is a function of the clock, shares
// the one mute control, and must not disturb the cue parity that §4.3 rests on.

/** Record every oscillator built, with its shape. */
async function recordCues(page) {
  await page.addInitScript(() => {
    window.__cues = [];
    const Real = window.AudioContext ?? window.webkitAudioContext;
    if (!Real) return;
    class Recording extends Real {
      createOscillator() {
        const osc = super.createOscillator();
        const entry = { type: null, freq: null };
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
}

const hasWebAudio = (page) =>
  page.evaluate(() => Boolean(window.AudioContext ?? window.webkitAudioContext));

const findMismatch = (page) =>
  page.evaluate(() => {
    const down = window.__fmTest.cards().filter((c) => c.state === 'down');
    const first = down[0];
    return [first.id, down.find((c) => c.fruit !== first.fruit).id];
  });

async function attempt(page, [a, b]) {
  await page.locator(`[data-card="${a}"]`).click();
  await page.locator(`[data-card="${b}"]`).click();
  await page.waitForFunction(() => window.__fmTest.state().busy === false, null, { timeout: 5000 });
  await page.waitForTimeout(80);
}

test('creates no audio context before a gesture', async ({ page }) => {
  // SPEC.md §4.2. Autoplay policy blocks it and the console warning would be a
  // small tell of its own.
  const constructed = [];
  await page.addInitScript(() => {
    window.__contexts = 0;
    const Real = window.AudioContext ?? window.webkitAudioContext;
    if (!Real) return;
    class Counting extends Real {
      constructor(...args) {
        super(...args);
        window.__contexts += 1;
      }
    }
    window.AudioContext = Counting;
    window.webkitAudioContext = Counting;
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  constructed.push(await page.evaluate(() => window.__contexts ?? 0));
  expect(constructed[0]).toBe(0);
});

test('fetches no audio assets', async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  const external = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin) external.push(request.url());
  });
  await page.goto('/?fm-test=1');
  await page.locator('[data-card="0"]').click();
  await page.waitForTimeout(500);
  expect(external).toEqual([]);
});

test('the mismatch cue is identical either side of the wall, with the bed running', async ({
  page,
}) => {
  // §4.3's parity, measured under the condition that actually ships: ambience
  // playing. The bed must not mask, detune, or otherwise disturb the cues.
  test.setTimeout(180_000);
  await recordCues(page);
  await page.goto('/?fm-test=1');
  test.skip(!(await hasWebAudio(page)), 'engine exposes no WebAudio to listen to');

  const buzzes = [];
  const collect = async () => {
    const cues = await page.evaluate(() => window.__cues.slice());
    const buzz = cues.filter((c) => c.freq !== null && c.freq < 300).pop();
    if (buzz) buzzes.push(`${buzz.type}:${buzz.freq}`);
  };

  // Honest failure.
  await attempt(page, await findMismatch(page));
  await collect();

  // Past the wall.
  for (let i = 0; i < 5; i += 1) {
    const pair = await page.evaluate(() => {
      const down = window.__fmTest.cards().filter((c) => c.state === 'down');
      for (let i = 0; i < down.length; i += 1) {
        for (let j = i + 1; j < down.length; j += 1) {
          if (down[i].fruit === down[j].fruit) return [down[i].id, down[j].id];
        }
      }
      return null;
    });
    if (!pair) break;
    await attempt(page, pair);
  }
  for (let i = 0; i < 4; i += 1) {
    await attempt(page, await findMismatch(page));
    await collect();
  }

  expect(buzzes.length).toBeGreaterThan(3);
  expect(new Set(buzzes).size, `cue shapes: ${[...new Set(buzzes)].join(' | ')}`).toBe(1);
});

test('the mute control silences the bed as well as the cues', async ({ page }) => {
  // One control, one key (SPEC.md §4.4).
  await page.goto('/?fm-test=1');
  const mute = page.locator('[data-control="mute"]');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(page.locator('[data-control="mute"]')).toHaveAttribute('aria-pressed', 'true');

  // With mute on, a gesture must build nothing at all.
  const built = await page.evaluate(async () => {
    let count = 0;
    const Real = window.AudioContext ?? window.webkitAudioContext;
    if (!Real) return 0;
    class Counting extends Real {
      constructor(...args) {
        super(...args);
        count += 1;
      }
    }
    window.AudioContext = Counting;
    document.querySelector('[data-card="0"]').click();
    await new Promise((r) => setTimeout(r, 300));
    return count;
  });
  expect(built).toBe(0);
});

test('leaks no nodes over a long session', async ({ page }) => {
  test.setTimeout(180_000);
  await recordCues(page);
  await page.goto('/?fm-test=1&fm-rig=0');
  test.skip(!(await hasWebAudio(page)), 'engine exposes no WebAudio to listen to');

  await attempt(page, await findMismatch(page));
  const after5 = await page.evaluate(() => window.__cues.length);
  for (let i = 0; i < 5; i += 1) await attempt(page, await findMismatch(page));
  const after10 = await page.evaluate(() => window.__cues.length);

  // Cue count grows with attempts and nothing else. A bed that accumulated
  // oscillators would show up here as runaway growth.
  const perAttempt = (after10 - after5) / 5;
  expect(perAttempt, `oscillators per attempt: ${perAttempt}`).toBeLessThan(8);
});
