import { STORAGE_KEYS, type Catalog, type StatusReport } from '@dashboard/shared';
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
    {
      id: 'mail',
      name: 'Mail',
      description: 'Group inbox.',
      url: 'https://mail.example.test/',
      icon: 'media.svg',
      requestable: false,
      services: [],
    },
  ],
};

/** App status is the worst among visible services: degraded. */
const statusReport: StatusReport = {
  collectedAt: '2026-01-01T12:00:00.000Z',
  applications: [
    {
      id: 'media',
      status: 'degraded',
      since: '2026-01-01T06:00:00.000Z',
      services: [
        { id: 'jellyfin', status: 'up', since: '2026-01-01T00:00:00.000Z' },
        { id: 'postgres', status: 'degraded', since: '2026-01-01T06:00:00.000Z' },
        { id: 'docs', status: null, since: null },
      ],
    },
    {
      id: 'mail',
      status: null,
      since: null,
      services: [],
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

async function stubApis(page: Page) {
  await stubSession(page);
  await stubCatalog(page);
  await stubStatus(page);
}

test('expander opens and closes by keyboard and announces expanded state', async ({ page }) => {
  await stubApis(page);
  await page.goto('/');

  const mediaRow = page.locator('[data-testid="application-row"][data-app-id="media"]');
  await expect(mediaRow).toBeVisible();

  const expander = mediaRow.getByTestId('status-summary-expander');
  await expect(expander).toBeVisible();
  await expect(page.getByTestId('status-summary-popover')).toHaveCount(0);
  await expect(expander).toHaveAttribute('aria-expanded', 'false');
  await expect(mediaRow.getByTestId('status-summary-panel')).toHaveCount(0);

  await expander.focus();
  await expect(expander).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(expander).toHaveAttribute('aria-expanded', 'true');
  await expect(mediaRow.getByTestId('status-summary-panel')).toBeVisible();
  await expect(mediaRow.getByTestId('status-summary-service')).toHaveCount(3);

  await page.keyboard.press('Space');
  await expect(expander).toHaveAttribute('aria-expanded', 'false');
  await expect(mediaRow.getByTestId('status-summary-panel')).toHaveCount(0);
});

test('popover replaces expander when status-summary-popover flag is on', async ({ page }) => {
  await stubApis(page);
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ 'status-summary-popover': true }));
  }, STORAGE_KEYS.flags);

  await page.goto('/');

  const mediaRow = page.locator('[data-testid="application-row"][data-app-id="media"]');
  await expect(mediaRow.getByTestId('status-summary-popover')).toBeVisible();
  await expect(mediaRow.getByTestId('status-summary-expander')).toHaveCount(0);

  const trigger = mediaRow.getByTestId('status-summary-trigger');
  await trigger.hover();
  await expect(mediaRow.getByTestId('status-summary-panel')).toBeVisible();
  await expect(mediaRow.getByTestId('status-summary-service')).toHaveCount(3);
});

test('toggling the flag in settings switches presentation without a reload', async ({ page }) => {
  await stubApis(page);
  await page.goto('/');

  const mediaRow = page.locator('[data-testid="application-row"][data-app-id="media"]');
  await expect(mediaRow.getByTestId('status-summary-expander')).toBeVisible();
  await expect(mediaRow.getByTestId('status-summary-popover')).toHaveCount(0);

  await page.getByTestId('nav-settings').click();
  await expect(page.getByTestId('settings-page')).toBeVisible();

  const toggle = page.getByTestId('settings-flag-toggle-status-summary-popover');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('link', { name: 'Applications' }).click();
  await expect(page.getByTestId('catalog-list')).toBeVisible();

  const mediaRowAgain = page.locator('[data-testid="application-row"][data-app-id="media"]');
  await expect(mediaRowAgain.getByTestId('status-summary-popover')).toBeVisible();
  await expect(mediaRowAgain.getByTestId('status-summary-expander')).toHaveCount(0);
});

test('list and grid show the same application status badge', async ({ page }) => {
  await stubApis(page);
  await page.goto('/');

  const listBadge = page.locator(
    '[data-testid="application-row"][data-app-id="media"] [data-testid="status-badge"]',
  );
  await expect(listBadge).toHaveAttribute('data-status', 'degraded');
  await expect(listBadge).toHaveText('Degraded');

  // Null application status renders no badge.
  await expect(
    page.locator(
      '[data-testid="application-row"][data-app-id="mail"] [data-testid="status-badge"]',
    ),
  ).toHaveCount(0);

  await page.getByTestId('catalog-view-grid').click();
  await expect(page.getByTestId('catalog-grid')).toBeVisible();

  const gridBadge = page.locator(
    '[data-testid="application-tile"][data-app-id="media"] [data-testid="status-badge"]',
  );
  await expect(gridBadge).toHaveAttribute('data-status', 'degraded');
  await expect(gridBadge).toHaveText('Degraded');
  await expect(
    page.locator(
      '[data-testid="application-tile"][data-app-id="mail"] [data-testid="status-badge"]',
    ),
  ).toHaveCount(0);
});
