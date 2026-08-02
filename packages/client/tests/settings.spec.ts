import type { Session } from '@dashboard/shared';
import { expect, test } from '@playwright/test';

import {
  stubAdminTopics,
  stubSession as stubAuthenticatedSession,
  stubStatus,
} from './helpers/stubs.js';

const nonAdminSession: Session = {
  name: 'Test User',
  email: 'test@example.com',
  admin: false,
  logoutUrl: 'https://auth.example/logout',
};

const adminSession: Session = {
  ...nonAdminSession,
  admin: true,
};

async function tabTo(page: import('@playwright/test').Page, locator: import('@playwright/test').Locator) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) {
      return;
    }

    await page.keyboard.press('Tab');
  }

  throw new Error('Could not reach the target element by keyboard');
}

async function stubSession(page: import('@playwright/test').Page, session: Session) {
  await stubAuthenticatedSession(page, session);
  await stubStatus(page);
}

test.describe('settings route', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      void navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    });
  });

  test('reaches settings from the cog by keyboard alone', async ({ page }) => {
    await stubSession(page, nonAdminSession);

    await page.goto('/');

    const settingsLink = page.getByRole('link', { name: 'Settings' });
    await tabTo(page, settingsLink);
    await Promise.all([page.waitForURL('**/settings'), page.keyboard.press('Enter')]);

    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  });

  test('hides the admin section when session.admin is false', async ({ page }) => {
    await stubSession(page, nonAdminSession);

    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await expect(page.getByTestId('settings-admin-section')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Administration' })).not.toBeVisible();
  });

  test('shows the admin section when session.admin is true', async ({ page }) => {
    await stubSession(page, adminSession);
    await stubAdminTopics(page, 200);

    await page.goto('/settings');

    await expect(page.getByTestId('settings-admin-section')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Administration', level: 2 })).toBeVisible();
    await expect(
      page.getByText('Administration tools will appear here.'),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Access denied' })).not.toBeVisible();
  });

  test('renders refusal when the admin endpoint answers 403', async ({ page }) => {
    await stubSession(page, adminSession);
    await stubAdminTopics(page, 403, { code: 'forbidden' });

    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
    await expect(
      page.getByText('You do not have permission to view this page.'),
    ).toBeVisible();
    await expect(page.getByTestId('settings-admin-section')).not.toBeVisible();
  });

  test('renders without horizontal scrolling at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await stubSession(page, adminSession);
    await stubAdminTopics(page, 200);

    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth > root.clientWidth;
    });

    expect(hasHorizontalOverflow).toBe(false);
  });
});
