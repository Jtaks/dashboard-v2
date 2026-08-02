import { STORAGE_KEYS, type Catalog } from '@dashboard/shared';
import { expect, test, type Page, type Route } from '@playwright/test';

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

const fakeEndpoint = 'https://push.example.test/subscriptions/device-1';
const fakeKeys = { p256dh: 'BPtest-p256dh-key-value', auth: 'test-auth-key' };
/** Valid-looking base64url public key (not a real VAPID secret; tests only). */
const fakePublicKey = 'BPabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV';

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

async function stubAlerts(page: Page) {
  await page.route('**/api/alerts', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: '[]',
    });
  });
}

async function stubSignedInShell(page: Page) {
  await stubSession(page);
  await stubCatalog(page);
  await stubStatus(page);
  await stubAlerts(page);
}

type PushStubMode = 'existing' | 'none';

async function installPushStubs(
  page: Page,
  options: {
    mode: PushStubMode;
    permission: 'default' | 'granted' | 'denied';
  },
) {
  await page.addInitScript(
    ({ mode, permission, endpoint, keys, publicKey }) => {
      const fakeSubscription = {
        endpoint,
        expirationTime: null,
        options: { userVisibleOnly: true, applicationServerKey: null },
        getKey() {
          return null;
        },
        toJSON() {
          return {
            endpoint,
            expirationTime: null,
            keys,
          };
        },
        unsubscribe: async () => true,
      };

      Object.defineProperty(Notification, 'permission', {
        configurable: true,
        get: () => permission,
      });

      Notification.requestPermission = async () => {
        Object.defineProperty(Notification, 'permission', {
          configurable: true,
          get: () => 'granted',
        });
        return 'granted';
      };

      const patch = () => {
        if (!('PushManager' in window)) {
          return;
        }
        PushManager.prototype.getSubscription = async function () {
          return mode === 'existing' ? fakeSubscription : null;
        };
        PushManager.prototype.subscribe = async function () {
          return fakeSubscription;
        };
      };

      patch();

      const ready = navigator.serviceWorker?.ready;
      if (ready && typeof ready.then === 'function') {
        void ready.then(() => patch());
      }

      // Expose key for subscribe path assertions (never a production literal path).
      (window as unknown as { __testPushPublicKey?: string }).__testPushPublicKey = publicKey;
    },
    {
      mode: options.mode,
      permission: options.permission,
      endpoint: fakeEndpoint,
      keys: fakeKeys,
      publicKey: fakePublicKey,
    },
  );
}

test('existing subscription upserts once and shows no prompt', async ({ page }) => {
  await stubSignedInShell(page);
  await installPushStubs(page, { mode: 'existing', permission: 'granted' });

  const posts: unknown[] = [];
  await page.route('**/api/push/subscriptions', async (route: Route) => {
    if (route.request().method() === 'POST') {
      posts.push(JSON.parse(route.request().postData() ?? '{}'));
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.fulfill({ status: 405, body: '' });
  });

  await page.goto('/');
  await expect(page.getByTestId('catalog-list')).toBeVisible();

  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toEqual({
    endpoint: fakeEndpoint,
    keys: fakeKeys,
  });

  await expect(page.getByTestId('push-prompt')).toHaveCount(0);
});

test('no subscription shows prompt; keyboard accept subscribes and upserts', async ({ page }) => {
  await stubSignedInShell(page);
  await installPushStubs(page, { mode: 'none', permission: 'default' });

  const posts: unknown[] = [];
  let keyGets = 0;

  await page.route('**/api/push/key', async (route) => {
    keyGets += 1;
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey: fakePublicKey }),
    });
  });

  await page.route('**/api/push/subscriptions', async (route: Route) => {
    if (route.request().method() === 'POST') {
      posts.push(JSON.parse(route.request().postData() ?? '{}'));
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.fulfill({ status: 405, body: '' });
  });

  await page.goto('/');
  await expect(page.getByTestId('push-prompt')).toBeVisible();
  await expect(page.getByTestId('push-prompt-title')).toBeVisible();

  const accept = page.getByTestId('push-prompt-accept');
  await accept.focus();
  await expect(accept).toBeFocused();
  await page.keyboard.press('Enter');

  await expect.poll(() => keyGets).toBe(1);
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toEqual({
    endpoint: fakeEndpoint,
    keys: fakeKeys,
  });
  await expect(page.getByTestId('push-prompt')).toHaveCount(0);
});

test('decline stores dismissed and does not return after reload', async ({ page }) => {
  await stubSignedInShell(page);
  await installPushStubs(page, { mode: 'none', permission: 'default' });

  await page.goto('/');
  await expect(page.getByTestId('push-prompt')).toBeVisible();

  await page.getByTestId('push-prompt-decline').click();
  await expect(page.getByTestId('push-prompt')).toHaveCount(0);
  await expect
    .poll(async () => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.pushPrompt))
    .toBe('dismissed');

  await page.reload();
  await expect(page.getByTestId('catalog-list')).toBeVisible();
  await expect(page.getByTestId('push-prompt')).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.pushPrompt)).toBe(
    'dismissed',
  );
});
