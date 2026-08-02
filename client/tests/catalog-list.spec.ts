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

test('populated catalog renders one row per application with name and description', async ({
  page,
}) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  await page.goto('/');

  const rows = page.getByTestId('application-row');
  await expect(page.getByTestId('catalog-list')).toBeVisible();
  await expect(rows).toHaveCount(3);

  await expect(rows.nth(0).getByTestId('application-name')).toHaveText('Media');
  await expect(rows.nth(0).getByTestId('application-description')).toHaveText('Films and series.');
  await expect(rows.nth(1).getByTestId('application-name')).toHaveText('Docs');
  await expect(rows.nth(1).getByTestId('application-description')).toHaveText(
    'Team documentation.',
  );
  await expect(rows.nth(2).getByTestId('application-name')).toHaveText('Mail');
  await expect(rows.nth(2).getByTestId('application-description')).toHaveText('Group inbox.');
});

test('icon link resolves to the application URL and leaves the dashboard', async ({ page }) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  await page.route('https://media.example.test/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>media</title><h1>media app</h1>',
    });
  });

  await page.goto('/');

  const iconLink = page.getByTestId('application-icon-link').first();
  await expect(iconLink).toHaveAttribute('href', 'https://media.example.test/');

  await Promise.all([page.waitForURL('https://media.example.test/'), iconLink.click()]);
  await expect(page.getByRole('heading', { name: 'media app' })).toBeVisible();
});

test('empty catalog is visibly distinct from a failed catalog request', async ({ page }) => {
  await stubSession(page);
  await stubCatalog(page, { applications: [] });

  await page.goto('/');
  await expect(page.getByTestId('catalog-empty')).toBeVisible();
  await expect(page.getByTestId('catalog-error')).toHaveCount(0);
  await expect(page.getByTestId('application-row')).toHaveCount(0);

  await page.unroute('**/api/catalog');
  await stubCatalog(page, null, 500);
  await page.reload();

  await expect(page.getByTestId('catalog-error')).toBeVisible();
  await expect(page.getByTestId('catalog-empty')).toHaveCount(0);
  await expect(page.getByTestId('catalog-retry')).toBeVisible();
});

test('loading state shows while the catalog request is in flight', async ({ page }) => {
  await stubSession(page);

  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route('**/api/catalog', async (route) => {
    await gate;
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(threeApps),
    });
  });

  await page.goto('/');
  await expect(page.getByTestId('catalog-loading')).toBeVisible();
  await expect(page.getByTestId('catalog-list')).toHaveCount(0);

  release();
  await expect(page.getByTestId('catalog-list')).toBeVisible();
  await expect(page.getByTestId('catalog-loading')).toHaveCount(0);
});

test('error retry refetches the catalog', async ({ page }) => {
  await stubSession(page);

  let calls = 0;
  await page.route('**/api/catalog', async (route) => {
    calls += 1;
    if (calls === 1) {
      await route.fulfill({
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'upstream_error' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(threeApps),
    });
  });

  await page.goto('/');
  await expect(page.getByTestId('catalog-error')).toBeVisible();

  await page.getByTestId('catalog-retry').click();
  await expect(page.getByTestId('catalog-list')).toBeVisible();
  await expect(page.getByTestId('application-row')).toHaveCount(3);
});

test('keyboard traversal reaches every icon link in row order and activates it', async ({
  page,
}) => {
  await stubSession(page);
  await stubCatalog(page, threeApps);

  await page.route('https://docs.example.test/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>docs</title><h1>docs app</h1>',
    });
  });

  await page.goto('/');
  await expect(page.getByTestId('catalog-list')).toBeVisible();

  const rows = page.getByTestId('application-row');
  const iconLinks = page.getByTestId('application-icon-link');
  const detailLinks = page.getByTestId('application-detail-link');
  await expect(iconLinks).toHaveCount(3);
  await expect(detailLinks).toHaveCount(3);

  // Tab order per row: icon (external) then detail body — distinct destinations.
  await iconLinks.nth(0).focus();
  await expect(iconLinks.nth(0)).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(detailLinks.nth(0)).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(iconLinks.nth(1)).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(detailLinks.nth(1)).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(iconLinks.nth(2)).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(detailLinks.nth(1)).toBeFocused();

  await iconLinks.nth(1).focus();
  await expect(rows.nth(1).getByTestId('application-icon-link')).toBeFocused();

  await Promise.all([page.waitForURL('https://docs.example.test/'), page.keyboard.press('Enter')]);
  await expect(page.getByRole('heading', { name: 'docs app' })).toBeVisible();
});
