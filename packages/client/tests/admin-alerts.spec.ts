import type { Alert, Session } from '@dashboard/shared';
import { expect, test } from '@playwright/test';

import {
  defaultSession,
  stubAdminAlerts,
  stubSession,
  stubStatus,
} from './helpers/stubs.js';

const adminSession: Session = {
  ...defaultSession,
  admin: true,
};

const existingAlert: Alert = {
  id: 'alert-1',
  severity: 'warning',
  title: 'Scheduled maintenance',
  body: 'Expect brief downtime.',
  topic: 'media-users',
  endsAt: '2099-01-01T12:00:00.000Z',
  createdAt: '2026-01-01T12:00:00.000Z',
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

async function stubAdminPage(
  page: import('@playwright/test').Page,
  options: Parameters<typeof stubAdminAlerts>[1] = {},
) {
  await stubSession(page, adminSession);
  await stubStatus(page);
  return stubAdminAlerts(page, options);
}

test.describe('admin alerts', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      void navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    });
  });

  test('creates an alert and shows it in the list', async ({ page }) => {
    await stubAdminPage(page);

    await page.goto('/admin');

    await page.getByTestId('admin-alert-severity').selectOption('error');
    await page.getByTestId('admin-alert-title').fill('Database outage');
    await page.getByTestId('admin-alert-body').fill('The database is unavailable.');
    await page.getByTestId('admin-alert-topic').selectOption('media-admins');
    await page.getByTestId('admin-alerts-submit').click();

    const row = page.getByTestId('admin-alert-row-alert-1');
    await expect(row).toBeVisible();
    await expect(row).toContainText('Database outage');
    await expect(row).toContainText('Error');
    await expect(row).toContainText('media-admins');
  });

  test('edits an alert without reloading the page', async ({ page }) => {
    await stubAdminPage(page, { alerts: [existingAlert] });

    await page.goto('/admin');

    await page.getByTestId(`admin-alert-edit-${existingAlert.id}`).click();
    await page.getByTestId('admin-alert-title').fill('Updated maintenance notice');
    await page.getByTestId('admin-alerts-submit').click();

    const row = page.getByTestId(`admin-alert-row-${existingAlert.id}`);
    await expect(row).toContainText('Updated maintenance notice');
    await expect(row).not.toContainText('Scheduled maintenance');
  });

  test('deletes an alert after confirmation', async ({ page }) => {
    await stubAdminPage(page, { alerts: [existingAlert] });

    await page.goto('/admin');

    await page.getByTestId(`admin-alert-delete-${existingAlert.id}`).click();
    await expect(page.getByRole('heading', { name: 'Delete alert?' })).toBeVisible();
    await page.getByTestId('admin-alerts-delete-confirm').click();

    await expect(page.getByTestId(`admin-alert-row-${existingAlert.id}`)).not.toBeVisible();
    await expect(page.getByText('No alerts yet.')).toBeVisible();
  });

  test('renders refusal when the admin API answers 403', async ({ page }) => {
    await stubAdminPage(page, { refuse: true });

    await page.goto('/admin');

    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
    await expect(
      page.getByText('You do not have permission to view this page.'),
    ).toBeVisible();
    await expect(page.getByTestId('admin-alerts-section')).not.toBeVisible();
    await expect(page.getByTestId('admin-alerts-form')).not.toBeVisible();
  });

  test('creates an alert using keyboard alone', async ({ page }) => {
    await stubAdminPage(page);

    await page.goto('/admin');

    await tabTo(page, page.getByTestId('admin-alert-severity'));
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Keyboard-only alert');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Created without a mouse.');
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await tabTo(page, page.getByTestId('admin-alerts-submit'));
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('admin-alert-row-alert-1')).toContainText('Keyboard-only alert');
  });
});
