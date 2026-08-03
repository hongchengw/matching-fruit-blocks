import { test, expect } from '@playwright/test';

// SPEC.md §7.1 and the visual invariant in §10.3.
//
// The player must never see the fruit a card was about to show. These tests
// sample every animation frame of a rigged reveal and assert that no frame in
// which the front face is readable carries the pre-swap sprite.

const TEST_PAGE = '/?fm-test=1';

/** Play five honest matches, which is what arms the rig at the default level. */
async function armRig(page) {
  for (let i = 0; i < 5; i += 1) {
    const [a, b] = await page.evaluate(() => {
      const cards = window.__fmTest.cards().filter((c) => c.state === 'down');
      for (let i = 0; i < cards.length; i += 1) {
        for (let j = i + 1; j < cards.length; j += 1) {
          if (cards[i].fruit === cards[j].fruit) return [cards[i].id, cards[j].id];
        }
      }
      return [];
    });
    await page.locator(`[data-card="${a}"]`).click();
    await page.locator(`[data-card="${b}"]`).click();
    await expect(page.locator(`[data-card="${b}"]`)).toHaveAttribute('data-state', 'locked');
  }
  expect(await page.evaluate(() => window.__fmTest.state().rigged)).toBe(true);
}

/** Ids for a rigged attempt: a first card, and a second of a different fruit. */
async function attemptPair(page) {
  return page.evaluate(() => {
    const down = window.__fmTest.cards().filter((c) => c.state === 'down');
    const first = down[0];
    const second = down.find((c) => c.fruit !== first.fruit);
    return { first: first.id, second: second.id, secondFruit: second.fruit };
  });
}

/**
 * Sample the flip frame by frame.
 *
 * `cos` is the first cell of the rotation matrix, so it is cos(angle): -1 is
 * fully face-on with the front showing, 0 is edge-on and unreadable. `isTrue`
 * says whether the painted sprite is the one the card was about to show.
 */
async function captureFlip(page, { second, secondFruit }) {
  return page.evaluate(
    async ({ second, secondFruit }) => {
      const { drawSprite } = await import('/js/sprites.js');
      const reference = document.createElement('canvas');
      drawSprite(reference, secondFruit);
      const signature = (canvas) =>
        canvas.getContext('2d').getImageData(0, 0, 16, 16).data.join(',');
      const preSwap = signature(reference);

      const element = document.querySelector(`[data-card="${second}"]`);
      const inner = element.querySelector('.card__inner');
      const canvas = element.querySelector('.card__face--front canvas');

      const frames = [];
      let running = true;
      const sample = () => {
        const m = getComputedStyle(inner).transform;
        const cos = m.startsWith('matrix') ? Number(m.slice(m.indexOf('(') + 1).split(',')[0]) : 1;
        const sig = signature(canvas);
        frames.push({ cos, isPreSwap: sig === preSwap, sig });
        if (running) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);

      element.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
      running = false;

      const distinct = [...new Set(frames.map((f) => f.sig))].length;
      return { frames: frames.map(({ cos, isPreSwap }) => ({ cos, isPreSwap })), distinct };
    },
    { second, secondFruit },
  );
}

/** Frames where the front face is turned far enough toward the player to read. */
const readable = (frames) => frames.filter((f) => f.cos < -0.35);

test('no frame shows the pre-swap fruit face-on', async ({ page }) => {
  await page.goto(TEST_PAGE);
  await armRig(page);

  const pair = await attemptPair(page);
  await page.locator(`[data-card="${pair.first}"]`).click();
  const capture = await captureFlip(page, pair);

  // The capture has to have actually observed the card face-on, or the
  // assertion below would be vacuous.
  expect(readable(capture.frames).length).toBeGreaterThan(0);
  expect(capture.frames.some((f) => f.cos < -0.9)).toBe(true);

  // The invariant itself (SPEC.md §10.3).
  expect(readable(capture.frames).filter((f) => f.isPreSwap)).toHaveLength(0);
});

test('the swap leaves no intermediate artifact', async ({ page }) => {
  await page.goto(TEST_PAGE);
  await armRig(page);

  const pair = await attemptPair(page);
  await page.locator(`[data-card="${pair.first}"]`).click();
  const capture = await captureFlip(page, pair);

  // Exactly two states across the whole flip: unpainted, then the final fruit.
  // A third would mean the card was drawn twice, which is the tear the spec
  // forbids.
  expect(capture.distinct).toBe(2);
});

test('reduced motion preserves the hiding place', async ({ page }) => {
  // The flip is shortened, never removed, and the midpoint is derived from the
  // duration, so the shortened flip must hide the swap just as well.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(TEST_PAGE);
  await armRig(page);

  const pair = await attemptPair(page);
  await page.locator(`[data-card="${pair.first}"]`).click();
  const capture = await captureFlip(page, pair);

  expect(readable(capture.frames).length).toBeGreaterThan(0);
  expect(readable(capture.frames).filter((f) => f.isPreSwap)).toHaveLength(0);
});

test('rigged timing is indistinguishable from honest timing', async ({ page }) => {
  // Timing is a detection channel too. A rigged attempt that ran noticeably
  // longer would be a tell no matter how well the sprite is hidden.
  const time = async (p) =>
    p.evaluate(async () => {
      const down = window.__fmTest.cards().filter((c) => c.state === 'down');
      const first = down[0];
      const second = down.find((c) => c.fruit !== first.fruit);
      const target = document.querySelector(`[data-card="${second.id}"]`);
      document.querySelector(`[data-card="${first.id}"]`).click();
      const started = performance.now();
      target.click();
      while (target.dataset.state !== 'down') {
        await new Promise((r) => requestAnimationFrame(r));
      }
      return performance.now() - started;
    });

  await page.goto(TEST_PAGE);
  const honest = await time(page);
  await armRig(page);
  const rigged = await time(page);

  expect(Math.abs(rigged - honest)).toBeLessThan(100);
});
