import { expect, test } from '@playwright/test';

test('playwright harness serves the static client shell', async ({ page }) => {
  await page.route('**/api/session', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        admin: false,
        logoutUrl: 'https://auth.example.test/logout',
      }),
    });
  });

  await page.goto('/');
  await expect(page.getByTestId('list-placeholder')).toBeVisible();
  await expect(page.getByRole('link', { name: 'dashboard' })).toBeVisible();
});
