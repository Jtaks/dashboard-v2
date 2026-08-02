import type { Catalog } from '@dashboard/shared';
import { expect, test } from '@playwright/test';

import { emptyStatusReport, stubSession, stubStatus } from './helpers/stubs.js';

const populatedCatalog: Catalog = {
  applications: [
    {
      id: 'app-one',
      name: 'App One',
      description: 'First application',
      url: 'https://app-one.example/',
      icon: 'app-one.svg',
      requestable: false,
      services: [],
    },
  ],
};

test.describe('status polling', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      void navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    });
  });

  test('does not poll while hidden and refetches once when visible again', async ({ page }) => {
    let statusRequestCount = 0;

    await stubSession(page);
    await page.route('**/api/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(populatedCatalog),
      });
    });
    await page.route('**/api/status', async (route) => {
      statusRequestCount += 1;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...emptyStatusReport,
          collectedAt: `2026-01-01T12:00:0${statusRequestCount}.000Z`,
        }),
      });
    });

    await page.goto('/');

    await expect.poll(() => statusRequestCount).toBeGreaterThanOrEqual(1);
    const requestsBeforeHide = statusRequestCount;

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      window.dispatchEvent(new Event('visibilitychange'));
    });

    await page.waitForTimeout(8_000);
    expect(statusRequestCount).toBe(requestsBeforeHide);

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
      window.dispatchEvent(new Event('visibilitychange'));
    });

    await expect.poll(() => statusRequestCount).toBe(requestsBeforeHide + 1);
  });
});
