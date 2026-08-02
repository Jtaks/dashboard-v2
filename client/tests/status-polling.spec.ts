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
      services: [],
    },
  ],
};

const statusReport: StatusReport = {
  collectedAt: '2026-01-01T12:00:00.000Z',
  applications: [
    {
      id: 'media',
      status: 'up',
      since: '2026-01-01T00:00:00.000Z',
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

async function setVisibility(page: Page, state: 'visible' | 'hidden') {
  await page.evaluate((visibilityState) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => visibilityState === 'hidden',
    });
    // TanStack Query listens on window; the native event bubbles.
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  }, state);
}

test('status polling pauses while hidden and refetches once on return', async ({ page }) => {
  await stubSession(page);
  await stubCatalog(page);

  const statusRequests: number[] = [];
  await page.route('**/api/status', async (route) => {
    statusRequests.push(Date.now());
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(statusReport),
    });
  });

  await page.goto('/');
  await expect(page.getByTestId('catalog-list')).toBeVisible();

  await expect.poll(() => statusRequests.length).toBe(1);
  const afterInitial = statusRequests.length;

  await setVisibility(page, 'hidden');
  await page.waitForTimeout(8_000);
  expect(statusRequests.length).toBe(afterInitial);

  await setVisibility(page, 'visible');
  await expect.poll(() => statusRequests.length).toBe(afterInitial + 1);
});
