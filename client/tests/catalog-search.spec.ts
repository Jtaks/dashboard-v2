import type { Catalog } from '@dashboard/shared';
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

async function stubCatalog(page: Page, body: Catalog) {
  await page.route('**/api/catalog', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  });
}

test('typing filters by name without another catalog request', async ({ page }) => {
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

  const input = page.getByTestId('catalog-search-input');
  await input.fill('mai');

  await expect(page.getByTestId('application-row')).toHaveCount(1);
  await expect(page.getByTestId('application-name')).toHaveText('Mail');
  expect(catalogCalls).toBe(1);
});

test('description fragment matches and case is ignored', async ({ page }) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  await page.goto('/');
  await expect(page.getByTestId('catalog-list')).toBeVisible();

  await page.getByTestId('catalog-search-input').fill('FILMS');
  await expect(page.getByTestId('application-row')).toHaveCount(1);
  await expect(page.getByTestId('application-name')).toHaveText('Media');
});

test('no match shows no-results; clear restores the full catalog', async ({ page }) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  await page.goto('/');
  await expect(page.getByTestId('catalog-list')).toBeVisible();

  await page.getByTestId('catalog-search-input').fill('xyzzy');
  await expect(page.getByTestId('catalog-no-results')).toBeVisible();
  await expect(page.getByTestId('catalog-empty')).toHaveCount(0);
  await expect(page.getByTestId('catalog-list')).toHaveCount(0);
  await expect(page.getByTestId('application-row')).toHaveCount(0);

  await page.getByTestId('catalog-search-clear').click();
  await expect(page.getByTestId('catalog-search-input')).toHaveValue('');
  await expect(page.getByTestId('catalog-list')).toBeVisible();
  await expect(page.getByTestId('application-row')).toHaveCount(3);
  await expect(page.getByTestId('catalog-no-results')).toHaveCount(0);
});

test('no-results clear control restores every application', async ({ page }) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  await page.goto('/');
  await page.getByTestId('catalog-search-input').fill('xyzzy');
  await expect(page.getByTestId('catalog-no-results')).toBeVisible();

  await page.getByTestId('catalog-no-results-clear').click();
  await expect(page.getByTestId('catalog-search-input')).toHaveValue('');
  await expect(page.getByTestId('application-row')).toHaveCount(3);
});

test('query survives list/grid switch and does not survive reload', async ({ page }) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  await page.goto('/');
  await page.getByTestId('catalog-search-input').fill('docs');
  await expect(page.getByTestId('application-row')).toHaveCount(1);

  await page.getByTestId('catalog-view-grid').click();
  await expect(page.getByTestId('catalog-grid')).toBeVisible();
  await expect(page.getByTestId('application-tile')).toHaveCount(1);
  await expect(page.getByTestId('catalog-search-input')).toHaveValue('docs');

  await page.getByTestId('catalog-view-list').click();
  await expect(page.getByTestId('catalog-list')).toBeVisible();
  await expect(page.getByTestId('application-row')).toHaveCount(1);
  await expect(page.getByTestId('catalog-search-input')).toHaveValue('docs');

  await page.reload();
  await expect(page.getByTestId('catalog-list')).toBeVisible();
  await expect(page.getByTestId('catalog-search-input')).toHaveValue('');
  await expect(page.getByTestId('application-row')).toHaveCount(3);
});

test('search input can be focused typed and cleared by keyboard alone', async ({ page }) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  await page.goto('/');
  await expect(page.getByTestId('catalog-list')).toBeVisible();

  const input = page.getByTestId('catalog-search-input');
  await input.focus();
  await expect(input).toBeFocused();

  await page.keyboard.type('mai');
  await expect(input).toHaveValue('mai');
  await expect(page.getByTestId('application-row')).toHaveCount(1);

  await page.keyboard.press('Tab');
  await expect(page.getByTestId('catalog-search-clear')).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(input).toHaveValue('');
  await expect(page.getByTestId('application-row')).toHaveCount(3);
  await expect(page.getByTestId('catalog-search-clear')).toHaveCount(0);
});
