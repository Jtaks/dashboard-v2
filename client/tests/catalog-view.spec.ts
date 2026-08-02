import { STORAGE_KEYS, type Catalog } from '@dashboard/shared';
import { expect, test, type Page } from '@playwright/test';

const sessionBody = {
  name: 'Test User',
  email: 'test@example.com',
  admin: false,
  logoutUrl: 'https://auth.example.test/logout',
};

const threeApps: Catalog = {
  applications: [
    {
      id: 'media',
      name: 'Media',
      description: 'Films and series.',
      url: 'https://media.example.test/',
      icon: 'media.svg',
      requestable: false,
      services: [],
    },
    {
      id: 'docs',
      name: 'Docs',
      description: 'Team documentation.',
      url: 'https://docs.example.test/',
      icon: 'missing-asset.svg',
      requestable: true,
      services: [],
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

async function stubSession(page: Page) {
  await page.route('**/api/session', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionBody),
    });
  });
}

async function stubCatalog(page: Page, body: Catalog | null, status = 200) {
  await page.route('**/api/catalog', async (route) => {
    if (status >= 400) {
      await route.fulfill({
        status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'upstream_error' }),
      });
      return;
    }
    await route.fulfill({
      status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? { applications: [] }),
    });
  });
}

test('switching to grid renders one tile per app without another catalog request', async ({
  page,
}) => {
  await stubSession(page);

  let catalogCalls = 0;
  await page.route('**/api/catalog', async (route) => {
    catalogCalls += 1;
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(threeApps),
    });
  });

  await page.goto('/');
  await expect(page.getByTestId('catalog-list')).toBeVisible();
  await expect(page.getByTestId('application-row')).toHaveCount(3);
  expect(catalogCalls).toBe(1);

  await page.getByTestId('catalog-view-grid').click();

  await expect(page.getByTestId('catalog-grid')).toBeVisible();
  await expect(page.getByTestId('application-tile')).toHaveCount(3);
  await expect(page.getByTestId('catalog-list')).toHaveCount(0);
  expect(catalogCalls).toBe(1);

  await expect(
    page.getByTestId('application-tile').nth(0).getByTestId('application-name'),
  ).toHaveText('Media');
  await expect(
    page.getByTestId('application-tile').nth(0).getByTestId('application-description'),
  ).toHaveText('Films and series.');
});

test('chosen view survives reload and matches dashboard.view', async ({ page }) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  await page.goto('/');
  await expect(page.getByTestId('catalog-list')).toBeVisible();

  await page.getByTestId('catalog-view-grid').click();
  await expect(page.getByTestId('catalog-grid')).toBeVisible();
  await expect
    .poll(async () => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.view))
    .toBe('grid');

  await page.reload();
  await expect(page.getByTestId('catalog-grid')).toBeVisible();
  await expect(page.getByTestId('application-tile')).toHaveCount(3);
  await expect(page.getByTestId('catalog-view-grid')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('catalog-view-list')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.view)).toBe('grid');
});

test('missing empty and unrecognised dashboard.view render list without error', async ({
  page,
}) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  await page.addInitScript((key) => {
    localStorage.removeItem(key);
  }, STORAGE_KEYS.view);
  await page.goto('/');
  await expect(page.getByTestId('catalog-list')).toBeVisible();
  await expect(page.getByTestId('catalog-error')).toHaveCount(0);
  await expect
    .poll(async () => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.view))
    .toBe('list');

  await page.evaluate((key) => localStorage.setItem(key, ''), STORAGE_KEYS.view);
  await page.reload();
  await expect(page.getByTestId('catalog-list')).toBeVisible();
  await expect(page.getByTestId('catalog-error')).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.view)).toBe('list');

  await page.evaluate((key) => localStorage.setItem(key, 'cards'), STORAGE_KEYS.view);
  await page.reload();
  await expect(page.getByTestId('catalog-list')).toBeVisible();
  await expect(page.getByTestId('catalog-error')).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.view)).toBe('list');
});

test('view control is keyboard operable and announces active state', async ({ page }) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  await page.goto('/');
  await expect(page.getByTestId('catalog-list')).toBeVisible();

  const listButton = page.getByTestId('catalog-view-list');
  const gridButton = page.getByTestId('catalog-view-grid');

  await expect(listButton).toHaveAttribute('aria-pressed', 'true');
  await expect(gridButton).toHaveAttribute('aria-pressed', 'false');

  await listButton.focus();
  await expect(listButton).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(gridButton).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('catalog-grid')).toBeVisible();
  await expect(gridButton).toHaveAttribute('aria-pressed', 'true');
  await expect(listButton).toHaveAttribute('aria-pressed', 'false');

  await listButton.focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('catalog-list')).toBeVisible();
  await expect(listButton).toHaveAttribute('aria-pressed', 'true');
  await expect(gridButton).toHaveAttribute('aria-pressed', 'false');
});

test('empty and error states render while grid is the active view', async ({ page }) => {
  await stubSession(page);
  await stubCatalog(page, { applications: [] });

  await page.addInitScript((key) => {
    localStorage.setItem(key, 'grid');
  }, STORAGE_KEYS.view);

  await page.goto('/');
  await expect(page.getByTestId('catalog-header')).toBeVisible();
  await expect(page.getByTestId('catalog-view-grid')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('catalog-empty')).toBeVisible();
  await expect(page.getByTestId('catalog-error')).toHaveCount(0);
  await expect(page.getByTestId('catalog-grid')).toHaveCount(0);

  await page.unroute('**/api/catalog');
  await stubCatalog(page, null, 500);
  await page.reload();

  await expect(page.getByTestId('catalog-view-grid')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('catalog-error')).toBeVisible();
  await expect(page.getByTestId('catalog-empty')).toHaveCount(0);
  await expect(page.getByTestId('catalog-retry')).toBeVisible();
});
