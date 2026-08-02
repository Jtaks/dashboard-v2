import type { Alert } from '@dashboard/shared';
import { STORAGE_KEY_ALERTS_DISMISSED } from '@dashboard/shared';
import { expect, test } from '@playwright/test';

import {
  defaultSession,
  readDismissedAlertIds,
  stubAlerts,
  stubCatalog,
  stubSession,
  stubStatus,
} from './helpers/stubs.js';

const emptyCatalog = { applications: [] };

const warningAlert: Alert = {
  id: 'alert-warning-1',
  severity: 'warning',
  title: 'Scheduled maintenance',
  body: 'Services may be unavailable tonight.',
  topic: '*',
  endsAt: null,
  createdAt: '2026-01-01T10:00:00.000Z',
};

const titleOnlyAlert: Alert = {
  id: 'alert-info-1',
  severity: 'info',
  title: 'Welcome back',
  body: null,
  topic: '*',
  endsAt: null,
  createdAt: '2026-01-01T09:00:00.000Z',
};

async function tabTo(
  page: import('@playwright/test').Page,
  locator: import('@playwright/test').Locator,
) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) {
      return;
    }

    await page.keyboard.press('Tab');
  }

  throw new Error('Could not reach the target element by keyboard');
}

async function stubAuthenticatedShell(page: import('@playwright/test').Page) {
  await stubSession(page, defaultSession);
  await stubCatalog(page, emptyCatalog);
  await stubStatus(page);
}

test.describe('alert banner', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      void navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    });
  });

  test('dismisses an alert, persists across reload, and hides title-only alerts without an empty body', async ({
    page,
  }) => {
    await stubAuthenticatedShell(page);
    await stubAlerts(page, [warningAlert, titleOnlyAlert]);
    await page.goto('/');

    const warningBanner = page.getByTestId(`alert-banner-${warningAlert.id}`);
    const titleOnlyBanner = page.getByTestId(`alert-banner-${titleOnlyAlert.id}`);

    await expect(warningBanner).toBeVisible();
    await expect(warningBanner).toContainText('Scheduled maintenance');
    await expect(warningBanner).toContainText('Services may be unavailable tonight.');
    await expect(titleOnlyBanner).toBeVisible();
    await expect(titleOnlyBanner).toContainText('Welcome back');
    await expect(titleOnlyBanner.locator('.alert-banner__body')).toHaveCount(0);

    await page.getByTestId(`alert-dismiss-${warningAlert.id}`).click();
    await expect(warningBanner).not.toBeVisible();
    await expect(titleOnlyBanner).toBeVisible();

    expect(await readDismissedAlertIds(page)).toEqual([warningAlert.id]);

    await page.reload();
    await expect(warningBanner).not.toBeVisible();
    await expect(titleOnlyBanner).toBeVisible();
    expect(await readDismissedAlertIds(page)).toEqual([warningAlert.id]);
  });

  test('dismisses an alert by keyboard alone', async ({ page }) => {
    await stubAuthenticatedShell(page);
    await stubAlerts(page, [warningAlert]);
    await page.goto('/');

    const warningBanner = page.getByTestId(`alert-banner-${warningAlert.id}`);
    await expect(warningBanner).toBeVisible();

    await tabTo(page, page.getByTestId(`alert-dismiss-${warningAlert.id}`));
    await page.keyboard.press('Enter');

    await expect(warningBanner).not.toBeVisible();
    expect(await readDismissedAlertIds(page)).toEqual([warningAlert.id]);
  });

  test('occupies no space when no alerts are returned', async ({ page }) => {
    await stubAuthenticatedShell(page);
    await stubAlerts(page, []);
    await page.goto('/');

    await expect(page.locator('.alerts-banner')).toHaveCount(0);
  });

  test('prunes dismissed ids when alerts stop being returned', async ({ page }) => {
    await stubAuthenticatedShell(page);
    const alertsStub = await stubAlerts(page, [warningAlert]);
    await page.goto('/');

    await page.getByTestId(`alert-dismiss-${warningAlert.id}`).click();
    expect(await readDismissedAlertIds(page)).toEqual([warningAlert.id]);

    alertsStub.setAlerts([]);
    await page.reload();
    await page.waitForResponse(
      (response) => response.url().includes('/api/alerts') && response.status() === 200,
    );

    expect(await readDismissedAlertIds(page)).toEqual([]);
    await expect(page.locator('.alerts-banner')).toHaveCount(0);
  });

  test('shows a republished alert with a new id after the old id was dismissed', async ({ page }) => {
    await stubAuthenticatedShell(page);
    const alertsStub = await stubAlerts(page, [warningAlert]);
    await page.goto('/');

    await page.getByTestId(`alert-dismiss-${warningAlert.id}`).click();
    await expect(page.getByTestId(`alert-banner-${warningAlert.id}`)).not.toBeVisible();

    const republishedAlert: Alert = {
      ...warningAlert,
      id: 'alert-warning-2',
      title: 'Maintenance rescheduled',
    };
    alertsStub.setAlerts([republishedAlert]);
    await page.reload();
    await page.waitForResponse(
      (response) => response.url().includes('/api/alerts') && response.status() === 200,
    );

    await expect(page.getByTestId(`alert-banner-${republishedAlert.id}`)).toBeVisible();
    await expect(page.getByTestId(`alert-banner-${republishedAlert.id}`)).toContainText(
      'Maintenance rescheduled',
    );
    expect(await readDismissedAlertIds(page)).toEqual([]);
  });

  test('renders visibly different banners per severity', async ({ page }) => {
    const alerts: Alert[] = [
      {
        id: 'alert-info',
        severity: 'info',
        title: 'Info alert',
        body: null,
        topic: '*',
        endsAt: null,
        createdAt: '2026-01-01T08:00:00.000Z',
      },
      {
        id: 'alert-success',
        severity: 'success',
        title: 'Success alert',
        body: null,
        topic: '*',
        endsAt: null,
        createdAt: '2026-01-01T08:01:00.000Z',
      },
      {
        id: 'alert-warning',
        severity: 'warning',
        title: 'Warning alert',
        body: null,
        topic: '*',
        endsAt: null,
        createdAt: '2026-01-01T08:02:00.000Z',
      },
      {
        id: 'alert-error',
        severity: 'error',
        title: 'Error alert',
        body: null,
        topic: '*',
        endsAt: null,
        createdAt: '2026-01-01T08:03:00.000Z',
      },
    ];

    await stubAuthenticatedShell(page);
    await stubAlerts(page, alerts);
    await page.goto('/');

    const infoStyles = await page.getByTestId('alert-banner-alert-info').evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        background: styles.backgroundColor,
        border: styles.borderColor,
      };
    });
    const successStyles = await page.getByTestId('alert-banner-alert-success').evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        background: styles.backgroundColor,
        border: styles.borderColor,
      };
    });
    const warningStyles = await page.getByTestId('alert-banner-alert-warning').evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        background: styles.backgroundColor,
        border: styles.borderColor,
      };
    });
    const errorStyles = await page.getByTestId('alert-banner-alert-error').evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        background: styles.backgroundColor,
        border: styles.borderColor,
      };
    });

    const allStyles = [infoStyles, successStyles, warningStyles, errorStyles];
    const uniqueBackgrounds = new Set(allStyles.map((style) => style.background));
    const uniqueBorders = new Set(allStyles.map((style) => style.border));

    expect(uniqueBackgrounds.size).toBe(4);
    expect(uniqueBorders.size).toBe(4);
  });
});
