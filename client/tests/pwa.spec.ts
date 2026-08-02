import { expect, test, type Page } from '@playwright/test';

const sessionBody = {
  name: 'Test User',
  email: 'test@example.com',
  admin: false,
  logoutUrl: 'https://auth.example.test/logout',
};

async function stubSessionAndCatalog(page: Page) {
  await page.route('**/api/session', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionBody),
    });
  });
  await page.route('**/api/catalog', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applications: [] }),
    });
  });
  await page.route('**/api/status', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applications: [] }),
    });
  });
  await page.route('**/api/alerts', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alerts: [] }),
    });
  });
}

async function waitForShellCache(page: Page) {
  await page.waitForFunction(async () => {
    const ready = await navigator.serviceWorker?.ready;
    if (!ready?.active) {
      return false;
    }
    const keys = await caches.keys();
    if (!keys.some((key) => key.startsWith('dashboard-shell-'))) {
      return false;
    }
    for (const key of keys) {
      if (!key.startsWith('dashboard-shell-')) {
        continue;
      }
      const cache = await caches.open(key);
      const requests = await cache.keys();
      if (requests.length > 0) {
        return true;
      }
    }
    return false;
  });
}

test('manifest is linked, parses, and every icon resolves', async ({ page, request }) => {
  await stubSessionAndCatalog(page);
  await page.goto('/');

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();

  const manifestUrl = new URL(href!, page.url()).toString();
  const manifestResponse = await request.get(manifestUrl);
  expect(manifestResponse.ok()).toBe(true);

  const manifest = (await manifestResponse.json()) as {
    name?: string;
    start_url?: string;
    display?: string;
    scope?: string;
    theme_color?: string;
    background_color?: string;
    icons?: Array<{ src: string; sizes?: string; purpose?: string }>;
  };

  expect(manifest.name).toBe('dashboard');
  expect(manifest.start_url).toBe('/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.scope).toBe('/');
  expect(manifest.theme_color).toBeTruthy();
  expect(manifest.background_color).toBeTruthy();
  expect(manifest.icons?.length).toBeGreaterThanOrEqual(2);

  // Origin-relative paths only — no deployment host baked into the bundle.
  const serialized = JSON.stringify(manifest);
  expect(serialized).not.toMatch(/https?:\/\//i);
  expect(serialized).not.toMatch(/localhost|127\.0\.0\.1|example\.(com|test)/i);

  for (const icon of manifest.icons ?? []) {
    expect(icon.src.startsWith('/')).toBe(true);
    expect(icon.src.startsWith('/icons/')).toBe(false);
    const iconResponse = await request.get(new URL(icon.src, page.url()).toString());
    expect(iconResponse.ok(), `icon ${icon.src}`).toBe(true);
    expect(iconResponse.headers()['content-type'] ?? '').toMatch(/image\//);
  }

  const apple = page.locator('link[rel="apple-touch-icon"]');
  const appleHref = await apple.getAttribute('href');
  expect(appleHref).toBeTruthy();
  const appleResponse = await request.get(new URL(appleHref!, page.url()).toString());
  expect(appleResponse.ok()).toBe(true);
});

test('install affordance appears only when beforeinstallprompt fires', async ({ page }) => {
  await stubSessionAndCatalog(page);
  await page.goto('/');
  await expect(page.getByTestId('catalog-empty')).toBeVisible();
  await expect(page.getByTestId('install-prompt')).toHaveCount(0);

  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
    };
    event.prompt = async () => undefined;
    event.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(event);
  });

  await expect(page.getByTestId('install-prompt')).toBeVisible();
  await expect(page.getByTestId('install-prompt-title')).toBeVisible();
  await page.getByTestId('install-prompt-dismiss').click();
  await expect(page.getByTestId('install-prompt')).toHaveCount(0);
});

test('offline previously-visited route renders shell; /api is not cached', async ({
  page,
  context,
}) => {
  await stubSessionAndCatalog(page);
  await page.goto('/');
  await expect(page.getByTestId('catalog-empty')).toBeVisible();
  await waitForShellCache(page);

  const apiCachedBefore = await page.evaluate(async () => {
    const keys = await caches.keys();
    for (const key of keys) {
      const cache = await caches.open(key);
      const requests = await cache.keys();
      if (requests.some((req) => new URL(req.url).pathname.startsWith('/api'))) {
        return true;
      }
    }
    return false;
  });
  expect(apiCachedBefore).toBe(false);

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await context.setOffline(true);

  await page.reload({ waitUntil: 'domcontentloaded' });

  // Application shell from the SW, not the browser offline interstitial.
  await expect(page.locator('body')).toHaveAttribute('data-sveltekit-preload-data', 'hover');
  await expect(
    page
      .getByTestId('signed-out')
      .or(page.getByTestId('session-loading'))
      .or(page.getByTestId('catalog-empty'))
      .or(page.getByRole('link', { name: 'dashboard' })),
  ).toBeVisible({ timeout: 15_000 });

  const apiProbe = await page.evaluate(async () => {
    try {
      const response = await fetch('/api/session', {
        headers: { Accept: 'application/json' },
      });
      return { ok: response.ok, status: response.status, networkError: false };
    } catch {
      return { ok: false, status: 0, networkError: true };
    }
  });
  expect(apiProbe.networkError || !apiProbe.ok).toBe(true);

  const apiCachedAfter = await page.evaluate(async () => {
    const keys = await caches.keys();
    for (const key of keys) {
      const cache = await caches.open(key);
      const requests = await cache.keys();
      if (requests.some((req) => new URL(req.url).pathname.startsWith('/api'))) {
        return true;
      }
    }
    return false;
  });
  expect(apiCachedAfter).toBe(false);
});
