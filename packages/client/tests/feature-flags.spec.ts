import type { Catalog, Session, StatusReport } from '@dashboard/shared';
import { STORAGE_KEY_FLAGS } from '@dashboard/shared';
import { expect, test } from '@playwright/test';

import {
  defaultSession,
  stubCatalog,
  stubSession,
  stubStatus,
} from './helpers/stubs.js';

const catalog: Catalog = {
  applications: [
    {
      id: 'media',
      name: 'Media',
      description: 'Films and series.',
      url: 'https://media.example/',
      icon: 'media.svg',
      requestable: false,
      services: [
        { id: 'jellyfin', name: 'Jellyfin', hasContainers: true },
        { id: 'db', name: 'Database', hasContainers: true },
      ],
    },
  ],
};

const statusReport: StatusReport = {
  collectedAt: '2026-01-01T12:00:00.000Z',
  applications: [
    {
      id: 'media',
      status: 'down',
      since: '2026-01-01T11:00:00.000Z',
      services: [
        { id: 'jellyfin', status: 'up', since: '2026-01-01T10:00:00.000Z' },
        { id: 'db', status: 'down', since: '2026-01-01T11:00:00.000Z' },
      ],
    },
  ],
};

const adminSession: Session = {
  ...defaultSession,
  admin: true,
};

async function tabTo(page: import('@playwright/test').Page, locator: import('@playwright/test').Locator) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) {
      return;
    }

    await page.keyboard.press('Tab');
  }

  throw new Error('Could not reach the target element by keyboard');
}

async function stubCatalogWithStatus(page: import('@playwright/test').Page) {
  await stubSession(page, defaultSession);
  await stubCatalog(page, catalog);
  await stubStatus(page, statusReport);
}

test.describe('feature flags', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      void navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    });
  });

  test('toggles a flag from settings by keyboard and persists across reload', async ({ page }) => {
    await stubCatalogWithStatus(page);
    await page.goto('/settings');

    const popoverToggle = page.getByTestId('feature-flag-dependencySummaryPopover');
    await expect(popoverToggle).not.toBeChecked();

    await tabTo(page, popoverToggle);
    await page.keyboard.press('Space');

    await expect(popoverToggle).toBeChecked();
    await expect
      .poll(async () =>
        page.evaluate(
          (storageKey) => JSON.parse(localStorage.getItem(storageKey) ?? '{}'),
          STORAGE_KEY_FLAGS,
        ),
      )
      .toEqual({ dependencySummaryPopover: true });

    await page.goto('/');

    await expect(page.getByRole('button', { name: /Show dependency breakdown/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Dependency status summary/i })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('button', { name: /Show dependency breakdown/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Dependency status summary/i })).toBeVisible();
  });

  test('lists only user flags for a non-admin session', async ({ page }) => {
    await stubSession(page, defaultSession);
    await stubStatus(page);
    await page.goto('/settings');

    await expect(page.getByTestId('settings-feature-flags-section')).toBeVisible();
    await expect(page.getByTestId('feature-flag-dependencySummaryPopover')).toBeVisible();
    await expect(page.getByTestId('feature-flag-adminExperimentalTools')).toHaveCount(0);
    await expect(page.getByText('Show experimental administrator tools')).not.toBeVisible();
  });

  test('lists admin flags for an admin session', async ({ page }) => {
    await stubSession(page, adminSession);
    await stubStatus(page);
    await page.goto('/settings');

    await expect(page.getByTestId('feature-flag-dependencySummaryPopover')).toBeVisible();
    await expect(page.getByTestId('feature-flag-adminExperimentalTools')).toBeVisible();
    await expect(page.getByText('Show experimental administrator tools')).toBeVisible();
  });
});
