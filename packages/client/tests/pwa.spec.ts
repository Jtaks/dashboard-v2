import { expect, test } from '@playwright/test';

import { stubSession as stubAuthenticatedSession, stubStatus } from './helpers/stubs.js';

const DEPLOYMENT_HOST_PATTERN = /localhost|127\.0\.0\.1|example\.com|https?:\/\//i;

async function waitForServiceWorker(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service worker is not available');
    }

    await navigator.serviceWorker.ready;
  });

  await page.waitForFunction(() => navigator.serviceWorker.controller != null);
}

async function waitForShellCache(
  page: import('@playwright/test').Page,
  pathname: string,
): Promise<void> {
  await page.waitForFunction(async (cachedPath) => {
    const cache = await caches.open('dashboard-shell-v1');
    const exact = await cache.match(cachedPath);
    const index = await cache.match('/index.html');
    return Boolean(exact || index);
  }, pathname);
}

test.describe('PWA manifest and install', () => {
  test('links a manifest that parses with origin-agnostic values', async ({ page }) => {
    await page.goto('/');

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBe('/manifest.webmanifest');

    const response = await page.request.get('/manifest.webmanifest');
    expect(response.ok()).toBe(true);

    const manifest = (await response.json()) as {
      name: string;
      short_name: string;
      start_url: string;
      scope: string;
      display: string;
      theme_color: string;
      background_color: string;
      icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
    };

    expect(manifest.name).toBe('Dashboard');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#1565c0');
    expect(manifest.background_color).toBe('#ffffff');

    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toMatch(DEPLOYMENT_HOST_PATTERN);

    for (const icon of manifest.icons) {
      expect(icon.src).not.toMatch(DEPLOYMENT_HOST_PATTERN);
      const iconResponse = await page.request.get(icon.src);
      expect(iconResponse.ok(), `icon ${icon.src} failed to load`).toBe(true);
      expect(iconResponse.headers()['content-type']).toContain('image/png');
    }

    const appleTouchHref = await page
      .locator('link[rel="apple-touch-icon"]')
      .getAttribute('href');
    expect(appleTouchHref).toMatch(/\/pwa\/apple-touch-icon\.png$/);

    const appleTouchResponse = await page.request.get('/pwa/apple-touch-icon.png');
    expect(appleTouchResponse.ok()).toBe(true);
    expect(appleTouchResponse.headers()['content-type']).toContain('image/png');
  });

  test('shows the install affordance only when the browser offers installation', async ({
    page,
  }) => {
    await stubAuthenticatedSession(page);
    await stubStatus(page);

    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

    await expect(page.getByTestId('install-app-button')).not.toBeVisible();

    await page.evaluate(() => {
      const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt: async () => undefined,
        userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
      });
      window.dispatchEvent(event);
    });

    await expect(page.getByRole('button', { name: 'Install app' })).toBeVisible();
  });

  test('loads a visited route from the cached shell when offline', async ({ page, context }) => {
    await stubAuthenticatedSession(page);
    await stubStatus(page);

    await page.goto('/');
    await waitForServiceWorker(page);
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await waitForServiceWorker(page);
    await waitForShellCache(page, '/settings');

    await context.setOffline(true);

    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });

  test('does not cache /api responses in the service worker', async ({ page }) => {
    await stubAuthenticatedSession(page);
    await stubStatus(page);

    await page.goto('/');
    await waitForServiceWorker(page);

    const cachedApi = await page.evaluate(async () => {
      const cacheNames = await caches.keys();

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();

        for (const request of requests) {
          if (new URL(request.url).pathname.startsWith('/api/')) {
            return true;
          }
        }
      }

      return false;
    });

    expect(cachedApi).toBe(false);
  });
});
