import type { Session } from '@dashboard/shared';
import { expect, test } from '@playwright/test';

import {
  defaultSession,
  stubAdminAlerts,
  stubAdminPush,
  stubSession,
  stubStatus,
} from './helpers/stubs.js';

const adminSession: Session = {
  ...defaultSession,
  admin: true,
};

async function tabTo(page: import('@playwright/test').Page, locator: import('@playwright/test').Locator) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) {
      return;
    }

    await page.keyboard.press('Tab');
  }

  throw new Error('Could not reach the target element by keyboard');
}

async function stubAdminPage(page: import('@playwright/test').Page) {
  await stubSession(page, adminSession);
  await stubStatus(page);
  await stubAdminAlerts(page);
}

test.describe('admin push', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      void navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    });
  });

  test('sends from the form and shows counts', async ({ page }) => {
    const { getLastPushBody } = await stubAdminPush(page, {
      pushResult: { attempted: 5, failed: 2 },
    });
    await stubSession(page, adminSession);
    await stubStatus(page);
    await stubAdminAlerts(page);

    await page.goto('/admin');

    await page.getByTestId('admin-push-title').fill('Database outage');
    await page.getByTestId('admin-push-body').fill('The database is unavailable.');
    await page.getByTestId('admin-push-url').fill('https://dashboard.example.com/status');
    await page.getByTestId('admin-push-topic').selectOption('media-admins');
    await page.getByTestId('admin-push-submit').click();

    expect(getLastPushBody()).toEqual({
      title: 'Database outage',
      body: 'The database is unavailable.',
      url: 'https://dashboard.example.com/status',
      topic: 'media-admins',
    });

    await expect(page.getByTestId('admin-push-attempted')).toHaveText('Attempted: 5');
    await expect(page.getByTestId('admin-push-failed')).toHaveText('Failed: 2');
  });

  test('renders refusal when the admin push API answers 403', async ({ page }) => {
    await stubAdminPush(page, { refuse: true });
    await stubSession(page, adminSession);
    await stubStatus(page);
    await stubAdminAlerts(page, { refuse: true });

    await page.goto('/admin');

    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
    await expect(
      page.getByText('You do not have permission to view this page.'),
    ).toBeVisible();
    await expect(page.getByTestId('admin-push-section')).not.toBeVisible();
    await expect(page.getByTestId('admin-push-form')).not.toBeVisible();
  });

  test('sends a push using keyboard alone', async ({ page }) => {
    await stubAdminPush(page);
    await stubSession(page, adminSession);
    await stubStatus(page);
    await stubAdminAlerts(page);

    await page.goto('/admin');

    await tabTo(page, page.getByTestId('admin-push-title'));
    await page.keyboard.type('Keyboard-only push');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Created without a mouse.');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown');
    await tabTo(page, page.getByTestId('admin-push-submit'));
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('admin-push-attempted')).toBeVisible();
    await expect(page.getByTestId('admin-push-failed')).toBeVisible();
  });
});
