import { expect, test } from '@playwright/test';

test('playwright harness is wired', async ({ page }) => {
  await page.setContent('<h1>dashboard</h1>');
  await expect(page.locator('h1')).toHaveText('dashboard');
});
