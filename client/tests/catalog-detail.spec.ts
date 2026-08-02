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

async function stubCatalog(page: Page, body: Catalog) {
  await page.route('**/api/catalog', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  });
}

test('list row pointer activation opens detail and back restores list', async ({ page }) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  await page.goto('/');
  await expect(page.getByTestId('catalog-list')).toBeVisible();

  await page.getByTestId('application-row').nth(0).getByTestId('application-detail-link').click();
  await expect(page).toHaveURL(/\/applications\/media$/);
  await expect(page.getByTestId('application-detail')).toBeVisible();
  await expect(page.getByTestId('application-name')).toHaveText('Media');
  await expect(page.getByTestId('application-description')).toHaveText('Films and series.');
  await expect(page.getByTestId('application-open-link')).toHaveAttribute(
    'href',
    'https://media.example.test/',
  );
  await expect(page.getByTestId('application-status-detail')).toBeAttached();

  await page.goBack();
  await expect(page.getByTestId('catalog-list')).toBeVisible();
  await expect(page.getByTestId('application-row')).toHaveCount(3);
});

test('grid tile pointer activation opens detail and back restores grid', async ({ page }) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  await page.goto('/');
  await page.getByTestId('catalog-view-grid').click();
  await expect(page.getByTestId('catalog-grid')).toBeVisible();

  await page.getByTestId('application-tile').nth(1).getByTestId('application-detail-link').click();
  await expect(page).toHaveURL(/\/applications\/docs$/);
  await expect(page.getByTestId('application-detail')).toBeVisible();
  await expect(page.getByTestId('application-name')).toHaveText('Docs');

  await page.goBack();
  await expect(page.getByTestId('catalog-grid')).toBeVisible();
  await expect(page.getByTestId('application-tile')).toHaveCount(3);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.view)).toBe('grid');
});

test('list row keyboard activation reaches detail without firing the icon link', async ({
  page,
}) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  await page.goto('/');
  await expect(page.getByTestId('catalog-list')).toBeVisible();

  const row = page.getByTestId('application-row').nth(0);
  const iconLink = row.getByTestId('application-icon-link');
  const detailLink = row.getByTestId('application-detail-link');

  await iconLink.focus();
  await expect(iconLink).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(detailLink).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/applications\/media$/);
  await expect(page.getByTestId('application-detail')).toBeVisible();
  await expect(page.getByTestId('application-name')).toHaveText('Media');
});

test('grid tile keyboard activation reaches detail', async ({ page }) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  await page.addInitScript((key) => {
    localStorage.setItem(key, 'grid');
  }, STORAGE_KEYS.view);

  await page.goto('/');
  await expect(page.getByTestId('catalog-grid')).toBeVisible();

  const tile = page.getByTestId('application-tile').nth(0);
  const detailLink = tile.getByTestId('application-detail-link');

  await detailLink.focus();
  await expect(detailLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/applications\/media$/);
  await expect(page.getByTestId('application-detail')).toBeVisible();
});

test('direct detail load fetches catalog without visiting the list first', async ({
  page,
  context,
}) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  const fresh = await context.newPage();
  await stubSession(fresh);
  await stubCatalog(fresh, threeApps);

  await fresh.goto('/applications/mail');
  await expect(fresh.getByTestId('application-detail')).toBeVisible();
  await expect(fresh.getByTestId('application-name')).toHaveText('Mail');
  await expect(fresh.getByTestId('application-description')).toHaveText('Group inbox.');
  await expect(fresh.getByTestId('application-open-link')).toHaveAttribute(
    'href',
    'https://mail.example.test/',
  );
  await expect(fresh.getByTestId('catalog-list')).toHaveCount(0);
});

test('unknown application id renders not-found', async ({ page }) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  await page.goto('/applications/does-not-exist');
  await expect(page.getByTestId('detail-not-found')).toBeVisible();
  await expect(page.getByTestId('application-detail')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Application not found' })).toBeVisible();
});

test('detail open link leaves the dashboard for the application url', async ({ page }) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  await page.route('https://media.example.test/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>media</title><h1>media app</h1>',
    });
  });

  await page.goto('/applications/media');
  await expect(page.getByTestId('application-detail')).toBeVisible();

  const openLink = page.getByTestId('application-open-link');
  await expect(openLink).toHaveAttribute('href', 'https://media.example.test/');

  await openLink.focus();
  await expect(openLink).toBeFocused();
  await Promise.all([page.waitForURL('https://media.example.test/'), page.keyboard.press('Enter')]);
  await expect(page.getByRole('heading', { name: 'media app' })).toBeVisible();
});
