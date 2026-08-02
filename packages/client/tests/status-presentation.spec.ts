import type { Catalog, StatusReport } from '@dashboard/shared';
import { expect, test } from '@playwright/test';

import {
  defaultSession,
  setFeatureFlag,
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
        { id: 'cache', status: null, since: null },
      ],
    },
  ],
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

test.describe('status presentation', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      void navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    });
  });

  test('opens and closes the dependency expander from the keyboard alone', async ({ page }) => {
    await stubCatalogWithStatus(page);
    await page.goto('/');

    const expander = page.locator('.dependency-summary__toggle');
    await expect(expander).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('Jellyfin')).not.toBeVisible();

    await tabTo(page, expander);
    await page.keyboard.press('Enter');

    await expect(expander).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Jellyfin')).toBeVisible();
    await expect(page.getByText('Database')).toBeVisible();

    await page.keyboard.press('Enter');

    await expect(expander).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('Jellyfin')).not.toBeVisible();
  });

  test('shows the popover instead of the expander when the flag is set', async ({ page }) => {
    await stubCatalogWithStatus(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        'dashboard.flags',
        JSON.stringify({ dependencySummaryPopover: true }),
      );
    });

    await page.goto('/');

    await expect(page.getByRole('button', { name: /Show dependency breakdown/i })).toHaveCount(0);

    const trigger = page.getByRole('button', { name: /Dependency status summary/i });
    await expect(trigger).toBeVisible();
    await expect(page.getByText('Jellyfin')).not.toBeVisible();

    await trigger.hover();

    await expect(page.getByRole('region', { name: 'Dependencies' })).toBeVisible();
    await expect(page.getByText('Jellyfin')).toBeVisible();
    await expect(page.getByText('Database')).toBeVisible();
  });

  test('shows the same application status in list and grid views', async ({ page }) => {
    await stubCatalogWithStatus(page);
    await page.goto('/');

    const listBadge = page.locator('.catalog-row .status-badge').first();
    await expect(listBadge).toHaveAttribute('aria-label', 'Down');
    await expect(page.getByText('1 up')).toBeVisible();
    await expect(page.getByText('1 down')).toBeVisible();

    await page.getByRole('button', { name: 'Grid view' }).click();

    const gridBadge = page.locator('.catalog-tile .status-badge').first();
    await expect(gridBadge).toHaveAttribute('aria-label', 'Down');
    await expect(page.locator('.catalog-tile').getByText('1 up')).toBeVisible();
    await expect(page.locator('.catalog-tile').getByText('1 down')).toBeVisible();
  });

  test('renders no badge when the application status is null', async ({ page }) => {
    await stubSession(page, defaultSession);
    await stubCatalog(page, {
      applications: [
        {
          id: 'links',
          name: 'Links',
          description: 'No containers here.',
          url: 'https://links.example/',
          icon: 'links.svg',
          requestable: false,
          services: [{ id: 'portal', name: 'Portal', hasContainers: false }],
        },
      ],
    });
    await stubStatus(page, {
      collectedAt: '2026-01-01T12:00:00.000Z',
      applications: [
        {
          id: 'links',
          status: null,
          since: null,
          services: [{ id: 'portal', status: null, since: null }],
        },
      ],
    });

    await page.goto('/');

    await expect(page.locator('.status-badge')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /dependency breakdown/i })).toHaveCount(0);
  });

  test('updates the presentation when the flag is toggled in local storage', async ({ page }) => {
    await stubCatalogWithStatus(page);
    await page.goto('/');

    await expect(page.getByRole('button', { name: /Show dependency breakdown/i })).toBeVisible();

    await setFeatureFlag(page, 'dependencySummaryPopover', true);

    await expect(page.getByRole('button', { name: /Show dependency breakdown/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Dependency status summary/i })).toBeVisible();
  });
});
