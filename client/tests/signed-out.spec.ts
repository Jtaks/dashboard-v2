import { expect, test } from '@playwright/test';

test('signed-out state is reachable and sign-in activates by keyboard alone', async ({ page }) => {
  const signInUrl = 'https://auth.example.test/login?rd=http%3A%2F%2F127.0.0.1%3A4173%2F';

  await page.route('**/api/session', async (route) => {
    await route.fulfill({
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        Location: signInUrl,
      },
      body: JSON.stringify({ code: 'unauthorized' }),
    });
  });

  await page.route('https://auth.example.test/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>auth</title><h1>auth portal</h1>',
    });
  });

  await page.goto('/');

  const signedOut = page.getByTestId('signed-out');
  await expect(signedOut).toBeVisible();
  await expect(page.getByTestId('forbidden')).toHaveCount(0);

  const signIn = page.getByTestId('sign-in');
  await expect(signIn).toBeVisible();
  await expect(signIn).toHaveAttribute('href', signInUrl);

  await page.keyboard.press('Tab');
  await expect(signIn).toBeFocused();
  await Promise.all([page.waitForURL(signInUrl), page.keyboard.press('Enter')]);
});

test('403 refusal is visibly distinct from signed-out', async ({ page }) => {
  await page.route('**/api/session', async (route) => {
    await route.fulfill({
      status: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'forbidden' }),
    });
  });

  await page.goto('/');

  await expect(page.getByTestId('forbidden')).toBeVisible();
  await expect(page.getByTestId('signed-out')).toHaveCount(0);
  await expect(page.getByTestId('sign-in')).toHaveCount(0);
});
