import { STORAGE_KEYS, type Alert, type Catalog } from '@dashboard/shared';
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
      services: [],
    },
  ],
};

function alertFixture(overrides: Partial<Alert> & Pick<Alert, 'id' | 'title'>): Alert {
  return {
    severity: 'warning',
    body: 'Please read this.',
    topic: '*',
    endsAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

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
      body: JSON.stringify({ collectedAt: '2026-01-01T00:00:00.000Z', applications: [] }),
    });
  });
}

async function stubAlerts(page: Page, alerts: Alert[]) {
  await page.route('**/api/alerts', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alerts),
    });
  });
}

test('dismiss hides an alert, writes storage, and persists across reload', async ({ page }) => {
  const alerts = [
    alertFixture({ id: 'alert-persist', title: 'Scheduled maintenance', body: 'Tonight.' }),
  ];
  await stubSession(page);
  await stubCatalog(page);
  await stubStatus(page);
  await stubAlerts(page, alerts);

  await page.goto('/');
  const banner = page.getByTestId('alert-banner');
  await expect(banner).toBeVisible();
  await expect(banner.getByTestId('alert-banner-title')).toHaveText('Scheduled maintenance');
  await expect(banner.getByTestId('alert-banner-body')).toHaveText('Tonight.');

  await page.getByTestId('alert-dismiss').click();
  await expect(page.getByTestId('alert-banners')).toHaveCount(0);
  await expect(page.getByTestId('alert-banner')).toHaveCount(0);

  await expect
    .poll(async () =>
      page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.alertsDismissed),
    )
    .toBe(JSON.stringify(['alert-persist']));

  await page.reload();
  await expect(page.getByTestId('catalog-list')).toBeVisible();
  await expect(page.getByTestId('alert-banner')).toHaveCount(0);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.alertsDismissed),
  ).toBe(JSON.stringify(['alert-persist']));
});

test('keyboard alone can dismiss an alert', async ({ page }) => {
  const alerts = [alertFixture({ id: 'alert-kbd', title: 'Keyboard dismiss', body: null })];
  await stubSession(page);
  await stubCatalog(page);
  await stubStatus(page);
  await stubAlerts(page, alerts);

  await page.goto('/');
  const banner = page.getByTestId('alert-banner');
  await expect(banner).toBeVisible();
  await expect(banner.getByTestId('alert-banner-body')).toHaveCount(0);

  await page.getByTestId('alert-dismiss').focus();
  await expect(page.getByTestId('alert-dismiss')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('alert-banner')).toHaveCount(0);
  await expect
    .poll(async () =>
      page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.alertsDismissed),
    )
    .toBe(JSON.stringify(['alert-kbd']));
});

test('each severity is visibly distinct and empty alerts occupy no space', async ({ page }) => {
  let alerts: Alert[] = [
    alertFixture({ id: 's-info', title: 'Info alert', severity: 'info', body: null }),
    alertFixture({ id: 's-success', title: 'Success alert', severity: 'success', body: 'Ok' }),
    alertFixture({ id: 's-warning', title: 'Warning alert', severity: 'warning', body: null }),
    alertFixture({ id: 's-error', title: 'Error alert', severity: 'error', body: 'Bad' }),
  ];
  await stubSession(page);
  await stubCatalog(page);
  await stubStatus(page);
  await page.route('**/api/alerts', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alerts),
    });
  });

  await page.goto('/');
  const banners = page.getByTestId('alert-banner');
  await expect(banners).toHaveCount(4);

  const backgrounds = await banners.evaluateAll((nodes) =>
    nodes.map((node) => getComputedStyle(node).backgroundColor),
  );
  expect(new Set(backgrounds).size).toBe(4);

  // Null body: title only, no empty body region.
  const infoBanner = page.locator('[data-alert-id="s-info"]');
  await expect(infoBanner.getByTestId('alert-banner-title')).toBeVisible();
  await expect(infoBanner.getByTestId('alert-banner-body')).toHaveCount(0);

  // Empty list: region gone and catalog not shifted by leftover banner chrome.
  alerts = [];
  await page.reload();
  await expect(page.getByTestId('catalog-list')).toBeVisible();
  await expect(page.getByTestId('alert-banners')).toHaveCount(0);
});

test('republished alert under a new id appears after the old id was dismissed', async ({
  page,
}) => {
  let alerts: Alert[] = [
    alertFixture({ id: 'alert-old', title: 'Same message', body: 'First publish.' }),
  ];
  await stubSession(page);
  await stubCatalog(page);
  await stubStatus(page);
  await page.route('**/api/alerts', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alerts),
    });
  });

  await page.goto('/');
  await expect(page.getByTestId('alert-banner')).toHaveCount(1);
  await page.getByTestId('alert-dismiss').click();
  await expect(page.getByTestId('alert-banner')).toHaveCount(0);

  alerts = [alertFixture({ id: 'alert-new', title: 'Same message', body: 'Republished.' })];
  await page.reload();
  await expect(page.getByTestId('alert-banner')).toBeVisible();
  await expect(page.getByTestId('alert-banner')).toHaveAttribute('data-alert-id', 'alert-new');
  await expect(page.getByTestId('alert-banner-body')).toHaveText('Republished.');
});
