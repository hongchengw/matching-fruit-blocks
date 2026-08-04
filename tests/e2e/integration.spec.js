import { test, expect } from '@playwright/test';

// SPEC.md §10.3 (the four invariants together) and §11 (the non-goals).
//
// Every test here drives the assembled game. This task adds no features: if
// one of these fails, the fix belongs in the task that owns the behavior.

const TEST_PAGE = '/?fm-test=1';

const FRUITS = ['apple', 'banana', 'carrot', 'corn', 'tomato', 'pumpkin'];

/** Card ids of an unmatched true pair, or null when none is left. */
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

/** Two face-down cards that do not match. */
const findMismatch = (page) =>
  page.evaluate(() => {
    const down = window.__fmTest.cards().filter((c) => c.state === 'down');
    const first = down[0];
    return [first.id, down.find((c) => c.fruit !== first.fruit).id];
  });

/** Click a pair and wait for the attempt to fully resolve. */
async function attempt(page, [a, b]) {
  await page.locator(`[data-card="${a}"]`).click();
  await page.locator(`[data-card="${b}"]`).click();
  await page.waitForFunction(() => window.__fmTest.state().busy === false, null, {
    timeout: 5000,
  });
  // The lock releases the moment the cards are told to flip back, so the
  // rotation is still running. Let it land before the next attempt starts.
  await page.waitForTimeout(250);
}

/** Unmatched fruit counts, the tally a suspicious player would take. */
const tally = (page) =>
  page.evaluate(() => {
    const counts = {};
    for (const card of window.__fmTest.cards()) {
      if (card.state !== 'locked') counts[card.fruit] = (counts[card.fruit] ?? 0) + 1;
    }
    return counts;
  });

test.describe('the full playthrough', () => {
  test('the honest phase, then the wall', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(TEST_PAGE);

    for (let i = 0; i < 5; i += 1) {
      const pair = await findPair(page);
      expect(pair, `honest match ${i + 1} should be available`).not.toBeNull();
      await attempt(page, pair);
    }
    expect(await page.locator('[data-card][data-state="locked"]').count()).toBe(10);
    expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(true);

    // Twenty attempts on cards the board itself says are true pairs.
    for (let i = 0; i < 20; i += 1) {
      const pair = await findPair(page);
      expect(pair, `attempt ${i + 1} should have a visible pair`).not.toBeNull();
      await attempt(page, pair);
      expect(await page.evaluate(() => window.__fmTest.state().matches)).toBe(5);
    }

    expect(await page.locator('[data-card][data-state="locked"]').count()).toBe(10);
  });

  test('all four invariants hold across the playthrough', async ({ page }) => {
    test.setTimeout(120_000);

    // Audio: record every cue as a shape, so a rigged mismatch that differed in
    // any parameter from an honest one shows up as a distinct signature.
    await page.addInitScript(() => {
      window.__cues = [];
      const Real = window.AudioContext ?? window.webkitAudioContext;
      // No WebAudio in Playwright's WebKit build. The audio half of this test
      // skips itself below rather than asserting over an empty recording.
      if (!Real) return;
      class Recording extends Real {
        createOscillator() {
          const osc = super.createOscillator();
          const entry = { type: null, freq: null, startAt: null, duration: null };
          window.__cues.push(entry);
          const freq = osc.frequency;
          const original = freq.setValueAtTime.bind(freq);
          freq.setValueAtTime = (v, t) => {
            entry.freq = v;
            return original(v, t);
          };
          const start = osc.start.bind(osc);
          const stop = osc.stop.bind(osc);
          // Both scheduled times come straight from the caller, so the duration
          // between them is exact. Measuring either one against currentTime
          // instead would fold in however long the call took and make two
          // identical cues look like 160ms and 159ms.
          //
          // Rounded to the microsecond because the caller schedules `at` and
          // `at + seconds`, and subtracting those two doubles back apart does
          // not return `seconds`: the rounding error depends on how large the
          // clock happens to be, so one 160ms buzz records as
          // 0.15999999999999992 and the next as 0.16000000000000014. That is
          // the recorder, not the cue. A microsecond is still four orders of
          // magnitude finer than anything a player could hear, so a genuine
          // divergence between two cues has nowhere to hide.
          osc.start = (t) => {
            entry.type = osc.type;
            entry.startAt = t;
            return start(t);
          };
          osc.stop = (t) => {
            entry.duration =
              entry.startAt === null ? null : Math.round((t - entry.startAt) * 1e6) / 1e6;
            return stop(t);
          };
          return osc;
        }
      }
      window.AudioContext = Recording;
      window.webkitAudioContext = Recording;
    });

    await page.goto(TEST_PAGE);
    expect(await page.evaluate(() => localStorage.getItem('fm.state'))).toContain('"rigLevel":5');

    const mismatchCues = [];
    const collectMismatchCue = async () => {
      // The mismatch buzz is the lowest note in the cue set, so it identifies
      // itself without the page having to label it.
      const cues = await page.evaluate(() => window.__cues.slice());
      const buzz = cues.filter((c) => c.freq !== null && c.freq < 300).pop();
      // Shape only: waveform, pitch, and length. The absolute schedule time
      // moves with the clock and says nothing about whether two cues sound
      // alike.
      if (buzz) {
        mismatchCues.push(JSON.stringify({ type: buzz.type, freq: buzz.freq, d: buzz.duration }));
      }
    };

    // Honest phase, with a deliberate honest failure to sample its cue.
    await attempt(page, await findMismatch(page));
    await collectMismatchCue();
    for (const count of Object.values(await tally(page))) expect(count % 2).toBe(0);

    for (let i = 0; i < 5; i += 1) {
      const pair = await findPair(page);
      if (!pair) break;
      await attempt(page, pair);
    }
    expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(true);

    // Rigged phase. Visual, tally, and audio checked on every single attempt.
    for (let i = 0; i < 12; i += 1) {
      const [a, b] = await findPair(page);

      const capture = await page.evaluate(
        async ({ a, b }) => {
          const { drawSprite } = await import('/js/sprites.js');
          const signature = (canvas) =>
            canvas.getContext('2d').getImageData(0, 0, 16, 16).data.join(',');
          const reference = (fruit) => {
            const c = document.createElement('canvas');
            drawSprite(c, fruit);
            return signature(c);
          };

          document.querySelector(`[data-card="${a}"]`).click();
          const element = document.querySelector(`[data-card="${b}"]`);
          const inner = element.querySelector('.card__inner');
          const canvas = element.querySelector('.card__face--front canvas');

          const frames = [];
          let running = true;
          const sample = () => {
            const m = getComputedStyle(inner).transform;
            const cos = m.startsWith('matrix')
              ? Number(m.slice(m.indexOf('(') + 1).split(',')[0])
              : 1;
            frames.push({ cos, sig: signature(canvas) });
            if (running) requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
          element.click();
          // Wait for the flip to be observed all the way round rather than for
          // a fixed stretch of wall clock. Frame delivery varies by engine and
          // by how loaded the machine is, and a window that is comfortable on
          // one can end before the card has turned on another.
          const deadline = performance.now() + 2000;
          while (performance.now() < deadline && !frames.some((f) => f.cos < -0.9)) {
            await new Promise((r) => setTimeout(r, 16));
          }
          running = false;

          const committed = window.__fmTest.cards().find((c) => c.id === b).fruit;
          const final = reference(committed);
          return {
            readableAndWrong: frames.filter((f) => f.cos < -0.35 && f.sig !== final).length,
            readable: frames.filter((f) => f.cos < -0.35).length,
          };
        },
        { a, b },
      );

      // Visual invariant, on every attempt.
      expect(capture.readable, `attempt ${i + 1} never showed the card`).toBeGreaterThan(0);
      expect(capture.readableAndWrong, `attempt ${i + 1} leaked a sprite`).toBe(0);

      await page.waitForFunction(() => window.__fmTest.state().busy === false, null, {
        timeout: 5000,
      });
      // Same settle as `attempt`: the lock releases while the cards are still
      // rotating back, and sampling the next flip through that tail would read
      // the previous attempt's face.
      await page.waitForTimeout(250);
      await collectMismatchCue();

      // Tally invariant, on every attempt.
      for (const [fruit, count] of Object.entries(await tally(page))) {
        expect(count % 2, `attempt ${i + 1}: ${fruit} count ${count} is odd`).toBe(0);
      }
    }

    // Audio invariant: the honest buzz and every rigged buzz are one shape.
    if (await page.evaluate(() => Boolean(window.AudioContext ?? window.webkitAudioContext))) {
      expect(mismatchCues.length).toBeGreaterThan(5);
      const shapes = [...new Set(mismatchCues)];
      // Named so a failure reports which shapes diverged rather than just a
      // count, since the whole point is what the difference was.
      expect(shapes, `mismatch cue shapes: ${shapes.join(' | ')}`).toHaveLength(1);
    }

    // Persistence invariant. Since task 25 the threshold is stable rather than
    // decaying, so what has to hold is that nothing moves it: not a reset, not
    // a reload, not a whole round of rigged play.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fm.state')).rigLevel)).toBe(
      5,
    );
    await page.locator('[data-control="reset"]').click();
    await page.reload();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fm.state')).rigLevel)).toBe(
      5,
    );
  });

  test('the game never ends', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/?fm-test=1&fm-rig=0');

    for (let i = 0; i < 50; i += 1) {
      await attempt(page, await findMismatch(page));
    }

    expect(await page.evaluate(() => window.__fmTest.state().matches)).toBe(0);
    expect(await page.locator('dialog, [role="dialog"], [role="alert"]').count()).toBe(0);
    const text = (await page.locator('.stall').innerText()).toLowerCase();
    for (const word of ['you win', 'game over', 'congratulations', 'try again', 'the end']) {
      expect(text).not.toContain(word);
    }
    expect(await page.locator('[data-card]').count()).toBe(36);
  });

  test('the counter stays frozen throughout', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(TEST_PAGE);
    for (let i = 0; i < 5; i += 1) await attempt(page, await findPair(page));

    const readout = page.locator('[data-readout="matches"]');
    await expect(readout).toHaveText('MATCHES MADE: 5/18');
    for (let i = 0; i < 12; i += 1) {
      await attempt(page, await findPair(page));
      await expect(readout).toHaveText('MATCHES MADE: 5/18');
    }
  });

  test('every round is honest then walled', async ({ page }) => {
    // Replaces `a full curse cycle`, which played to the wall five times and
    // asserted the honest phase shortened 4, 3, 2, 1, 0 until the first attempt
    // of a fresh board failed forever. Task 25 removed the compounding curse at
    // the owner's direction, so that behavior no longer exists to assert.
    //
    // The property that replaces it is the one the game now has: the shape of a
    // round repeats exactly, round after round. Five honest matches, then a
    // wall, then a reset that restores neither more nor less than it should.
    test.setTimeout(180_000);
    await page.goto(TEST_PAGE);

    for (let round = 1; round <= 3; round += 1) {
      expect(
        await page.evaluate(() => JSON.parse(localStorage.getItem('fm.state')).rigLevel),
        `rigLevel drifted by round ${round}`,
      ).toBe(5);
      expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(false);

      for (let i = 0; i < 5; i += 1) {
        const pair = await findPair(page);
        expect(pair, `round ${round}, honest match ${i + 1}`).not.toBeNull();
        await attempt(page, pair);
      }
      expect(await page.evaluate(() => window.__fmTest.state().matches)).toBe(5);
      expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(true);

      // The wall, in every round.
      await attempt(page, await findPair(page));
      expect(await page.evaluate(() => window.__fmTest.state().matches)).toBe(5);

      await page.locator('[data-control="reset"]').click();
    }
  });
});

test.describe('responsive', () => {
  const VIEWPORTS = [375, 768, 1024, 1440];

  test('renders across viewports', async ({ page }) => {
    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal scroll at ${width}px`).toBeLessThanOrEqual(0);

      expect(await page.locator('[data-card]').count()).toBe(36);
      for (const region of ['awning', 'signboard', 'scoreboard', 'grid', 'base']) {
        await expect(page.locator(`[data-region="${region}"]`)).toBeVisible();
      }
    }
  });

  test('cards stay square at every width', async ({ page }) => {
    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const skew = await page.evaluate(() =>
        [...document.querySelectorAll('[data-card]')].map((el) => {
          const r = el.getBoundingClientRect();
          return Math.abs(r.width - r.height);
        }),
      );
      expect(Math.max(...skew), `cards skewed at ${width}px`).toBeLessThanOrEqual(1);
    }
  });

  test('tap targets hold at the smallest viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    const widths = await page.evaluate(() =>
      [...document.querySelectorAll('[data-card]')].map((el) => el.getBoundingClientRect().width),
    );
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(40);
  });

  test('sprites stay legible at the shipped card size', async ({ page }) => {
    // The silhouettes have to discriminate at the size the game actually ships
    // at, not at a comfortable test size.
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    const size = Math.floor(
      await page.evaluate(() => document.querySelector('[data-card]').getBoundingClientRect().width),
    );

    const masks = await page.evaluate(
      async ({ fruits, size }) => {
        const { drawSprite } = await import('/js/sprites.js');
        return fruits.map((fruit) => {
          const source = document.createElement('canvas');
          drawSprite(source, fruit);
          const scaled = document.createElement('canvas');
          scaled.width = size;
          scaled.height = size;
          const ctx = scaled.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(source, 0, 0, size, size);
          const { data } = ctx.getImageData(0, 0, size, size);
          const mask = [];
          for (let i = 3; i < data.length; i += 4) mask.push(data[i] > 128 ? 1 : 0);
          return mask;
        });
      },
      { fruits: FRUITS, size },
    );

    for (let i = 0; i < masks.length; i += 1) {
      for (let j = i + 1; j < masks.length; j += 1) {
        const differing = masks[i].reduce((n, v, k) => n + (v === masks[j][k] ? 0 : 1), 0);
        const share = differing / masks[i].length;
        expect(share, `${FRUITS[i]} vs ${FRUITS[j]} at ${size}px`).toBeGreaterThan(0.12);
      }
    }
  });
});

test.describe('regression sweep', () => {
  test('no console errors during a long session', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(String(error)));

    await page.goto('/?fm-test=1&fm-rig=0');
    for (let i = 0; i < 50; i += 1) await attempt(page, await findMismatch(page));

    expect(errors).toEqual([]);
  });

  test('makes no runtime network requests beyond app files', async ({ page, baseURL }) => {
    // Compared against baseURL, not page.url(): the very first request fires
    // while the page is still about:blank, whose origin is "null".
    const origin = new URL(baseURL).origin;
    const external = [];
    page.on('request', (request) => {
      if (new URL(request.url()).origin !== origin) external.push(request.url());
    });

    await page.goto(TEST_PAGE);
    for (let i = 0; i < 5; i += 1) await attempt(page, await findMismatch(page));
    await page.locator('[data-control="reset"]').click();

    expect(external).toEqual([]);
  });

  test('leaks no listeners or nodes over a long session', async ({ page }) => {
    // Fifty reshuffles that each leaked a listener would eventually degrade the
    // timing, and timing is a detection channel too.
    test.setTimeout(180_000);
    await page.goto('/?fm-test=1&fm-rig=0');

    const measure = () =>
      page.evaluate(() => ({
        nodes: document.querySelectorAll('*').length,
        canvases: document.querySelectorAll('canvas').length,
      }));

    for (let i = 0; i < 5; i += 1) await attempt(page, await findMismatch(page));
    const before = await measure();

    for (let i = 0; i < 45; i += 1) await attempt(page, await findMismatch(page));
    const after = await measure();

    expect(after).toEqual(before);
  });
});
