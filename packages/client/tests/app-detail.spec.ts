import type { Application, Catalog, Session, StatusReport } from '@dashboard/shared';
import { expect, test } from '@playwright/test';

import { stubSession as stubAuthenticatedSession, stubStatus } from './helpers/stubs.js';

const session: Session = {
  name: 'Test User',
  email: 'test@example.com',
  admin: false,
  logoutUrl: 'https://auth.example/logout',
};

const applications: Application[] = [
  {
    id: 'app-one',
    name: 'App One',
    description: 'First application',
    url: 'https://app-one.example/',
    icon: 'app-one.svg',
    requestable: false,
    services: [],
  },
  {
    id: 'app-two',
    name: 'App Two',
    description: 'Second application',
    url: 'https://app-two.example/',
    icon: 'app-two.svg',
    requestable: false,
    services: [],
  },
];

const mediaApplication: Application = {
  id: 'media',
  name: 'Media',
  description: 'Films and series.',
  url: 'https://media.example/',
  icon: 'media.svg',
  requestable: false,
  services: [
    { id: 'jellyfin', name: 'Jellyfin', hasContainers: true },
    { id: 'db', name: 'Database', hasContainers: true },
    { id: 'portal', name: 'Portal', hasContainers: false },
  ],
};

const mediaStatusReport: StatusReport = {
  collectedAt: '2026-01-04T12:00:00.000Z',
  applications: [
    {
      id: 'media',
      status: 'degraded',
      since: '2026-01-01T12:00:00.000Z',
      services: [
        { id: 'jellyfin', status: 'up', since: '2026-01-04T11:58:30.000Z' },
        { id: 'db', status: 'down', since: '2026-01-01T11:00:00.000Z' },
        { id: 'portal', status: null, since: null },
      ],
    },
  ],
};

const populatedCatalog: Catalog = { applications };

async function stubSession(page: import('@playwright/test').Page) {
  await stubAuthenticatedSession(page, session);
  await stubStatus(page);
}

async function stubCatalog(page: import('@playwright/test').Page, catalog: Catalog = populatedCatalog) {
  await page.route('**/api/catalog', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(catalog),
    });
  });
}

async function tabTo(page: import('@playwright/test').Page, locator: import('@playwright/test').Locator) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) {
      return;
    }

    await page.keyboard.press('Tab');
  }

  throw new Error('Could not reach the target element by keyboard');
}

test.describe('application detail route', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      void navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    });
  });

  test('navigates from a list row by pointer and browser back returns to the catalog', async ({ page }) => {
    await stubSession(page);
    await stubCatalog(page);

    await page.goto('/');

    await page.locator('a.catalog-row__link').filter({ hasText: 'App One' }).click();
    await expect(page).toHaveURL('/apps/app-one');
    await expect(page.getByRole('heading', { name: 'App One', level: 1 })).toBeVisible();
    await expect(page.getByText('First application')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Applications', level: 1 })).toBeVisible();
  });

  test('navigates from a list row by keyboard without activating the icon link', async ({ page }) => {
    await stubSession(page);
    await stubCatalog(page);

    await page.goto('/');

    const rowLink = page.locator('a.catalog-row__link').filter({ hasText: 'App One' });
    const iconLink = page.getByRole('link', { name: 'Open App One' });

    await tabTo(page, rowLink);
    await expect(iconLink).not.toBeFocused();

    await Promise.all([page.waitForURL('/apps/app-one'), page.keyboard.press('Enter')]);

    await expect(page.getByRole('heading', { name: 'App One', level: 1 })).toBeVisible();
  });

  test('navigates from a grid tile by pointer and browser back returns to the catalog', async ({ page }) => {
    await stubSession(page);
    await stubCatalog(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Grid view' }).click();

    await page.locator('a.catalog-tile__link').filter({ hasText: 'App Two' }).click();
    await expect(page).toHaveURL('/apps/app-two');
    await expect(page.getByRole('heading', { name: 'App Two', level: 1 })).toBeVisible();
    await expect(page.getByText('Second application')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Applications', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('navigates from a grid tile by keyboard without activating the icon link', async ({ page }) => {
    await stubSession(page);
    await stubCatalog(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Grid view' }).click();

    const tileLink = page.locator('a.catalog-tile__link').filter({ hasText: 'App Two' });
    const iconLink = page.getByRole('link', { name: 'Open App Two' });

    await tabTo(page, tileLink);
    await expect(iconLink).not.toBeFocused();

    await Promise.all([page.waitForURL('/apps/app-two'), page.keyboard.press('Enter')]);

    await expect(page.getByRole('heading', { name: 'App Two', level: 1 })).toBeVisible();
  });

  test('loads the detail route directly in a fresh tab', async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      void navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    });

    const page = await context.newPage();
    await stubSession(page);
    await stubCatalog(page);

    await page.goto('/apps/app-two');

    await expect(page.getByRole('heading', { name: 'App Two', level: 1 })).toBeVisible();
    await expect(page.getByText('Second application')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open App Two' })).toHaveAttribute(
      'href',
      'https://app-two.example/',
    );

    await context.close();
  });

  test('renders not-found for an id missing from the catalog', async ({ page }) => {
    await stubSession(page);
    await stubCatalog(page);

    await page.goto('/apps/missing-app');

    await expect(page.getByRole('heading', { name: 'Application not found', level: 1 })).toBeVisible();
    await expect(
      page.getByText('This application is not in your catalog, or you do not have access to it.'),
    ).toBeVisible();
  });

  test('reaches the home link by keyboard on the not-found state', async ({ page }) => {
    await stubSession(page);
    await stubCatalog(page);

    await page.goto('/apps/missing-app');

    const homeLink = page.getByRole('link', { name: 'Home' });
    await tabTo(page, homeLink);

    await Promise.all([page.waitForURL('/'), page.keyboard.press('Enter')]);

    await expect(page.getByRole('heading', { name: 'Applications', level: 1 })).toBeVisible();
  });

  test('reaches the link out by keyboard alone', async ({ page }) => {
    await stubSession(page);
    await stubCatalog(page, { applications: [applications[0]] });
    await page.route('https://app-one.example/**', async (route) => {
      await route.fulfill({ status: 200, body: 'ok' });
    });

    await page.goto('/apps/app-one');

    const openLink = page.getByRole('link', { name: 'Open App One' });
    await tabTo(page, openLink);

    await Promise.all([
      page.waitForURL('https://app-one.example/'),
      page.keyboard.press('Enter'),
    ]);
  });

  test('leaves the dashboard when the link out is activated by pointer', async ({ page }) => {
    await stubSession(page);
    await stubCatalog(page, { applications: [applications[0]] });
    await page.route('https://app-one.example/**', async (route) => {
      await route.fulfill({ status: 200, body: 'ok' });
    });

    await page.goto('/apps/app-one');

    await page.getByRole('link', { name: 'Open App One' }).click();
    await expect(page).toHaveURL('https://app-one.example/');
  });

  test('reserves a status region for later service detail', async ({ page }) => {
    await stubSession(page);
    await stubCatalog(page, { applications: [applications[0]] });

    await page.goto('/apps/app-one');

    await expect(page.locator('[data-status-region="true"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Service status', level: 2 })).toBeVisible();
  });

  test('shows per-service badges, uptime, and keyboard-reachable service rows', async ({ page }) => {
    await stubSession(page);
    await stubCatalog(page, { applications: [mediaApplication] });
    await stubStatus(page, mediaStatusReport);

    await page.goto('/apps/media');

    const headerBadge = page.locator('.app-detail__status-summary .status-badge');
    await expect(headerBadge).toHaveAttribute('aria-label', 'Degraded');
    await expect(page.locator('.app-detail__uptime')).toHaveText('for 3 days');

    const serviceRows = page.locator('.service-list__button');
    await expect(serviceRows).toHaveCount(3);

    const jellyfinRow = serviceRows.filter({ hasText: 'Jellyfin' });
    await expect(jellyfinRow.locator('.status-badge')).toHaveAttribute('aria-label', 'Up');
    await expect(jellyfinRow.locator('.service-list__uptime')).toHaveText('for 1 minute');

    const databaseRow = serviceRows.filter({ hasText: 'Database' });
    await expect(databaseRow.locator('.status-badge')).toHaveAttribute('aria-label', 'Down');
    await expect(databaseRow.locator('.service-list__uptime')).toHaveText('for 3 days');

    const portalRow = serviceRows.filter({ hasText: 'Portal' });
    await expect(portalRow.locator('.status-badge')).toHaveCount(0);
    await expect(portalRow.locator('.service-list__uptime')).toHaveCount(0);

    const openLink = page.getByRole('link', { name: 'Open Media' });
    await tabTo(page, openLink);

    await tabTo(page, serviceRows.nth(0));
    await tabTo(page, serviceRows.nth(1));
    await tabTo(page, serviceRows.nth(2));
  });
});
