import { STORAGE_KEYS } from '@dashboard/shared';
import { expect, test, type Page, type Route } from '@playwright/test';

const sessionBody = {
  name: 'Test User',
  email: 'test@example.com',
  admin: false,
  logoutUrl: 'https://auth.example.test/logout',
};

const fakeEndpoint = 'https://push.example.test/subscriptions/settings-1';
const fakeKeys = { p256dh: 'BPtest-p256dh-key-value', auth: 'test-auth-key' };
const fakePublicKey = 'BPabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function stubSession(page: Page) {
  await page.route('**/api/session', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionBody),
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

async function stubStatus(page: Page) {
  await page.route('**/api/status', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectedAt: '2026-01-01T00:00:00.000Z', applications: [] }),
    });
  });
}

async function stubSignedInSettings(page: Page) {
  await stubSession(page);
  await stubAlerts(page);
  await stubStatus(page);
}

type PushStubOptions = {
  mode: 'existing' | 'none';
  permission: 'default' | 'granted' | 'denied';
  /** Override navigator.userAgent for iOS notice tests. */
  userAgent?: string;
  navigatorStandalone?: boolean;
  displayModeStandalone?: boolean;
};

/**
 * Install mutable push stubs. Subscribe/unsubscribe flip `__testPushSubscribed`
 * so the settings section tracks the live browser subscription, not localStorage.
 */
async function installPushStubs(page: Page, options: PushStubOptions) {
  await page.addInitScript(
    ({
      mode,
      permission,
      endpoint,
      keys,
      publicKey,
      userAgent,
      navigatorStandalone,
      displayModeStandalone,
    }) => {
      const revoked = sessionStorage.getItem('__testPushRevoked') === '1';
      const state = {
        subscribed: mode === 'existing' && !revoked,
        permission,
      };

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
        unsubscribe: async () => {
          state.subscribed = false;
          return true;
        },
      };

      Object.defineProperty(Notification, 'permission', {
        configurable: true,
        get: () => state.permission,
      });

      Notification.requestPermission = async () => {
        state.permission = 'granted';
        Object.defineProperty(Notification, 'permission', {
          configurable: true,
          get: () => state.permission,
        });
        return 'granted';
      };

      const patch = () => {
        if (!('PushManager' in window)) {
          return;
        }
        PushManager.prototype.getSubscription = async function () {
          return state.subscribed ? fakeSubscription : null;
        };
        PushManager.prototype.subscribe = async function () {
          state.subscribed = true;
          return fakeSubscription;
        };
      };

      patch();

      const ready = navigator.serviceWorker?.ready;
      if (ready && typeof ready.then === 'function') {
        void ready.then(() => patch());
      }

      if (typeof userAgent === 'string') {
        Object.defineProperty(navigator, 'userAgent', {
          configurable: true,
          get: () => userAgent,
        });
      }

      Object.defineProperty(navigator, 'standalone', {
        configurable: true,
        get: () => navigatorStandalone === true,
      });

      const originalMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = ((query: string) => {
        if (query.includes('display-mode: standalone')) {
          return {
            matches: displayModeStandalone === true,
            media: query,
            onchange: null,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() {
              return false;
            },
          } as MediaQueryList;
        }
        return originalMatchMedia(query);
      }) as typeof window.matchMedia;

      (window as unknown as { __testPushPublicKey?: string }).__testPushPublicKey = publicKey;
      (window as unknown as { __testPushRevoke?: () => void }).__testPushRevoke = () => {
        state.subscribed = false;
        sessionStorage.setItem('__testPushRevoked', '1');
      };
    },
    {
      mode: options.mode,
      permission: options.permission,
      endpoint: fakeEndpoint,
      keys: fakeKeys,
      publicKey: fakePublicKey,
      userAgent: options.userAgent ?? null,
      navigatorStandalone: options.navigatorStandalone ?? false,
      displayModeStandalone: options.displayModeStandalone ?? false,
    },
  );
}

async function stubPushApi(page: Page) {
  const posts: unknown[] = [];
  const deletes: unknown[] = [];
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
    const method = route.request().method();
    if (method === 'POST') {
      posts.push(JSON.parse(route.request().postData() ?? '{}'));
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    if (method === 'DELETE') {
      deletes.push(JSON.parse(route.request().postData() ?? '{}'));
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.fulfill({ status: 405, body: '' });
  });

  return { posts, deletes, getKeyGets: () => keyGets };
}

test('settings shows subscribed status from the browser subscription', async ({ page }) => {
  await stubSignedInSettings(page);
  await installPushStubs(page, { mode: 'existing', permission: 'granted' });
  const api = await stubPushApi(page);

  // localStorage would misleadingly say "dismissed" — status must ignore it.
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'dismissed');
  }, STORAGE_KEYS.pushPrompt);

  await page.goto('/settings');

  await expect(page.getByTestId('settings-push')).toHaveAttribute('data-push-status', 'subscribed');
  await expect(page.getByTestId('settings-push-status')).toHaveText('Subscribed on this device');
  await expect(page.getByTestId('settings-push-unsubscribe')).toBeVisible();
  await expect(page.getByTestId('settings-push-subscribe')).toHaveCount(0);
  await expect(page.getByTestId('settings-push-blocked-body')).toHaveCount(0);
  await expect.poll(() => api.posts.length).toBeGreaterThanOrEqual(1);
});

test('settings shows not subscribed when the browser has no subscription', async ({ page }) => {
  await stubSignedInSettings(page);
  await installPushStubs(page, { mode: 'none', permission: 'default' });
  await stubPushApi(page);

  await page.goto('/settings');

  await expect(page.getByTestId('settings-push')).toHaveAttribute(
    'data-push-status',
    'not_subscribed',
  );
  await expect(page.getByTestId('settings-push-status')).toHaveText(
    'Not subscribed on this device',
  );
  await expect(page.getByTestId('settings-push-subscribe')).toBeVisible();
  await expect(page.getByTestId('settings-push-unsubscribe')).toHaveCount(0);
});

test('settings shows blocked state with explanation and no actions when denied', async ({
  page,
}) => {
  await stubSignedInSettings(page);
  await installPushStubs(page, { mode: 'none', permission: 'denied' });
  await stubPushApi(page);

  await page.goto('/settings');

  await expect(page.getByTestId('settings-push')).toHaveAttribute('data-push-status', 'blocked');
  await expect(page.getByTestId('settings-push-status')).toHaveText('Notifications are blocked');
  await expect(page.getByTestId('settings-push-blocked-body')).toBeVisible();
  await expect(page.getByTestId('settings-push-subscribe')).toHaveCount(0);
  await expect(page.getByTestId('settings-push-unsubscribe')).toHaveCount(0);
});

test('iOS Safari notice appears only outside an installed PWA', async ({ page }) => {
  await stubSignedInSettings(page);
  await installPushStubs(page, {
    mode: 'none',
    permission: 'default',
    userAgent: IPHONE_SAFARI,
    navigatorStandalone: false,
    displayModeStandalone: false,
  });
  await stubPushApi(page);

  await page.goto('/settings');
  await expect(page.getByTestId('settings-push-ios-notice')).toBeVisible();
});

test('iOS Safari notice is absent when installed as a PWA', async ({ page }) => {
  await stubSignedInSettings(page);
  await installPushStubs(page, {
    mode: 'none',
    permission: 'default',
    userAgent: IPHONE_SAFARI,
    navigatorStandalone: true,
    displayModeStandalone: false,
  });
  await stubPushApi(page);

  await page.goto('/settings');
  await expect(page.getByTestId('settings-push-ios-notice')).toHaveCount(0);
});

test('iOS Safari notice is absent on desktop Chromium', async ({ page }) => {
  await stubSignedInSettings(page);
  await installPushStubs(page, { mode: 'none', permission: 'default' });
  await stubPushApi(page);

  await page.goto('/settings');
  await expect(page.getByTestId('settings-push-ios-notice')).toHaveCount(0);
});

test('subscribe posts the subscription and clears the dismissed prompt key', async ({ page }) => {
  await stubSignedInSettings(page);
  await installPushStubs(page, { mode: 'none', permission: 'default' });
  const api = await stubPushApi(page);

  await page.addInitScript((key) => {
    localStorage.setItem(key, 'dismissed');
  }, STORAGE_KEYS.pushPrompt);

  await page.goto('/settings');
  await expect(page.getByTestId('settings-push-subscribe')).toBeVisible();

  await page.getByTestId('settings-push-subscribe').click();

  await expect.poll(() => api.getKeyGets()).toBe(1);
  await expect.poll(() => api.posts.length).toBe(1);
  expect(api.posts[0]).toEqual({
    endpoint: fakeEndpoint,
    keys: fakeKeys,
  });
  await expect(page.getByTestId('settings-push')).toHaveAttribute('data-push-status', 'subscribed');
  await expect
    .poll(async () => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.pushPrompt))
    .toBeNull();
});

test('unsubscribe deletes the server row after dropping the browser subscription', async ({
  page,
}) => {
  await stubSignedInSettings(page);
  await installPushStubs(page, { mode: 'existing', permission: 'granted' });
  const api = await stubPushApi(page);

  await page.goto('/settings');
  await expect(page.getByTestId('settings-push-unsubscribe')).toBeVisible();

  await page.getByTestId('settings-push-unsubscribe').click();

  await expect.poll(() => api.deletes.length).toBe(1);
  expect(api.deletes[0]).toEqual({ endpoint: fakeEndpoint });
  await expect(page.getByTestId('settings-push')).toHaveAttribute(
    'data-push-status',
    'not_subscribed',
  );
  await expect(page.getByTestId('settings-push-subscribe')).toBeVisible();
});

test('subscribe and unsubscribe are keyboard operable', async ({ page }) => {
  await stubSignedInSettings(page);
  await installPushStubs(page, { mode: 'none', permission: 'default' });
  const api = await stubPushApi(page);

  await page.goto('/settings');

  const subscribe = page.getByTestId('settings-push-subscribe');
  await subscribe.focus();
  await expect(subscribe).toBeFocused();
  await page.keyboard.press('Enter');

  await expect.poll(() => api.posts.length).toBe(1);
  await expect(page.getByTestId('settings-push')).toHaveAttribute('data-push-status', 'subscribed');

  const unsubscribe = page.getByTestId('settings-push-unsubscribe');
  await unsubscribe.focus();
  await expect(unsubscribe).toBeFocused();
  await page.keyboard.press('Enter');

  await expect.poll(() => api.deletes.length).toBe(1);
  await expect(page.getByTestId('settings-push')).toHaveAttribute(
    'data-push-status',
    'not_subscribed',
  );
});

test('status follows a browser revoke after refresh, not localStorage', async ({ page }) => {
  await stubSignedInSettings(page);
  await installPushStubs(page, { mode: 'existing', permission: 'granted' });
  await stubPushApi(page);

  await page.addInitScript((key) => {
    localStorage.setItem(key, 'dismissed');
  }, STORAGE_KEYS.pushPrompt);

  await page.goto('/settings');
  await expect(page.getByTestId('settings-push')).toHaveAttribute('data-push-status', 'subscribed');

  await page.evaluate(() => {
    (window as unknown as { __testPushRevoke: () => void }).__testPushRevoke();
  });

  // Re-enter settings so the section re-reads getSubscription().
  await page.goto('/');
  await page.goto('/settings');

  await expect(page.getByTestId('settings-push')).toHaveAttribute(
    'data-push-status',
    'not_subscribed',
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.pushPrompt),
  ).toBe('dismissed');
});
