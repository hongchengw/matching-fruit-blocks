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
