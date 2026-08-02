import { expect, test } from '@playwright/test';

const settingsSignInUrl =
  'https://auth.example/login?rd=https%3A%2F%2Flocalhost%3A4174%2Fsettings';
const homeSignInUrl = 'https://auth.example/login?rd=https%3A%2F%2Flocalhost%3A4174%2F';

test.describe('signed-out state', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      void navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    });
  });

  test('renders sign-in state with return URL on 401', async ({ page }) => {
    await page.route('**/api/session', async (route) => {
      await route.fulfill({
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          Location: settingsSignInUrl,
        },
        body: JSON.stringify({ code: 'unauthorized' }),
      });
    });

    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Sign in required' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      settingsSignInUrl,
    );
    await expect(page.getByRole('heading', { name: 'Access denied' })).not.toBeVisible();
  });

  test('reaches and activates the sign-in link by keyboard alone', async ({ page }) => {
    await page.route('**/api/session', async (route) => {
      await route.fulfill({
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          Location: homeSignInUrl,
        },
        body: JSON.stringify({ code: 'unauthorized' }),
      });
    });

    await page.route('https://auth.example/**', async (route) => {
      await route.fulfill({ status: 200, body: 'ok' });
    });

    await page.goto('/');

    const signInLink = page.getByRole('link', { name: 'Sign in' });
    await expect(signInLink).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(signInLink).toBeFocused();

    await Promise.all([
      page.waitForURL(homeSignInUrl),
      page.keyboard.press('Enter'),
    ]);
  });
});
