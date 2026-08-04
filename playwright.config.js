import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  /*
   * Playwright's default is half the logical cores, which on a 12-core machine
   * means six browsers at once. This suite cannot afford that. Half its tests
   * assert on animation timing: the 180ms flip, the 1000ms flip-back, and the
   * swap that has to land inside the first half of a rotation. Those are
   * real-time deadlines, and six headless browsers competing for the CPU
   * (Firefox renders in software here) miss them often enough to fail ten
   * tests a run for reasons that have nothing to do with the app.
   *
   * Three keeps the engines busy without the timing tests measuring the
   * machine's load instead of the product.
   */
  workers: 3,
  /*
   * One retry, for browser-level faults only.
   *
   * Firefox intermittently fails `browserContext.close` with a juggler protocol
   * error ("can't access property _maybeDontRestoreTabs") after the test body
   * has already passed. That is the driver tearing down a window, not anything
   * this project controls, and it lands on a different test each time.
   *
   * This does not hide anything. Playwright reports a test that needed its
   * retry as "flaky", not as "passed", and a flaky result here is a defect to
   * investigate rather than a green light. A test that actually fails still
   * fails both attempts.
   */
  retries: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  /*
   * Three engines, because the midpoint swap depends on transition timing and
   * that is the most likely thing to differ between them (SPEC.md §7.1). The
   * visual snapshot gets a baseline per engine; they render text and masks
   * differently and there is no single correct image.
   */
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'node scripts/serve.js',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
  },
});
