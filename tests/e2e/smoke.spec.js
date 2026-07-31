import { test, expect } from '@playwright/test';

test('playwright serves the project root', async ({ page }) => {
  // Fails until playwright.config.js configures the static `webServer`.
  const response = await page.goto('/');
  expect(response.status()).toBe(200);
  await expect(page.locator('body')).toBeAttached();
});
