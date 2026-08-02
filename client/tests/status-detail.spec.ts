import type { Catalog, StatusReport } from '@dashboard/shared';
import { expect, test, type Page } from '@playwright/test';

const sessionBody = {
  name: 'Test User',
  email: 'test@example.com',
  admin: false,
  logoutUrl: 'https://auth.example.test/logout',
};

const catalog: Catalog = {
  applications: [
    {
      id: 'media',
      name: 'Media',
      description: 'Films and series.',
      url: 'https://media.example.test/',
      icon: 'media.svg',
      requestable: false,
      services: [
        { id: 'jellyfin', name: 'Jellyfin', hasContainers: true },
        { id: 'postgres', name: 'Postgres', hasContainers: true },
        { id: 'docs', name: 'Docs link', hasContainers: false },
      ],
    },
  ],
};

const statusReport: StatusReport = {
  collectedAt: '2026-01-04T00:00:00.000Z',
  applications: [
    {
      id: 'media',
      status: 'degraded',
      since: '2026-01-03T00:00:00.000Z',
      services: [
        { id: 'jellyfin', status: 'up', since: '2026-01-01T00:00:00.000Z' },
        { id: 'postgres', status: 'degraded', since: '2026-01-03T00:00:00.000Z' },
        { id: 'docs', status: null, since: null },
      ],
    },
  ],
};

async function stubSession(page: Page) {
  await page.route('**/api/session', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionBody),
    });
  });
}

async function stubCatalog(page: Page) {
  await page.route('**/api/catalog', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(catalog),
    });
  });
}

async function stubStatus(page: Page) {
  await page.route('**/api/status', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(statusReport),
    });
  });
}

test('detail shows per-service badges, an uptime string, and keyboard-reachable rows', async ({
  page,
}) => {
  await stubSession(page);
  await stubCatalog(page);
  await stubStatus(page);

  await page.goto('/applications/media');
  await expect(page.getByTestId('application-detail')).toBeVisible();

  const headerStatus = page.getByTestId('application-header-status');
  await expect(headerStatus.getByTestId('status-badge')).toHaveAttribute('data-status', 'degraded');
  await expect(page.getByTestId('application-uptime')).toBeVisible();
  await expect(page.getByTestId('application-uptime')).toContainText(/for \d+ (day|days)/);

  const rows = page.getByTestId('service-status-row');
  await expect(rows).toHaveCount(3);

  const jellyfin = page.locator('[data-testid="service-status-row"][data-service-id="jellyfin"]');
  await expect(jellyfin.getByTestId('status-badge')).toHaveAttribute('data-status', 'up');
  await expect(jellyfin.getByTestId('service-uptime')).toBeVisible();
  await expect(jellyfin.getByTestId('service-uptime')).toContainText(/for \d+ (day|days)/);

  const postgres = page.locator('[data-testid="service-status-row"][data-service-id="postgres"]');
  await expect(postgres.getByTestId('status-badge')).toHaveAttribute('data-status', 'degraded');

  const docs = page.locator('[data-testid="service-status-row"][data-service-id="docs"]');
  await expect(docs).toHaveAttribute('data-has-containers', 'false');
  await expect(docs.getByTestId('status-badge')).toHaveCount(0);
  await expect(docs.getByTestId('service-uptime')).toHaveCount(0);

  // Keyboard walk across service list rows.
  await jellyfin.focus();
  await expect(jellyfin).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(postgres).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(docs).toBeFocused();

  const openLink = page.getByTestId('application-open-link');
  await openLink.focus();
  await expect(openLink).toBeFocused();
});
