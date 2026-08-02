import type { Page } from '@playwright/test';

const TEST_VAPID_PUBLIC_KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

export type PushSubscriptionJson = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type PushEnvironmentOptions = {
  permission?: NotificationPermission;
  subscription?: PushSubscriptionJson | null;
};

export async function stubPushEnvironment(
  page: Page,
  options: PushEnvironmentOptions = {},
): Promise<void> {
  const permission = options.permission ?? 'default';
  const subscription = options.subscription ?? null;

  await page.addInitScript(
    ({ permissionValue, subscriptionValue }) => {
      const createSubscription = (value: {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      }) => {
        const subscription = {
          endpoint: value.endpoint,
          expirationTime: null,
          options: {
            applicationServerKey: new Uint8Array(),
            userVisibleOnly: true,
          },
          getKey: () => null,
          toJSON: () => ({
            endpoint: value.endpoint,
            expirationTime: null,
            keys: value.keys,
          }),
          unsubscribe: async () => {
            currentSubscription = null;
            return true;
          },
        };

        return subscription;
      };

      let currentSubscription =
        subscriptionValue === null ? null : createSubscription(subscriptionValue);

      const pushManager = {
        getSubscription: async () => currentSubscription,
        subscribe: async (options: PushSubscriptionOptions) => {
          const nextSubscription = createSubscription({
            endpoint: 'https://push.example/subscription/new',
            keys: {
              p256dh: 'new-p256dh',
              auth: 'new-auth',
            },
          });
          nextSubscription.options = options;
          currentSubscription = nextSubscription;
          return currentSubscription;
        },
      };

      const registration = {
        pushManager,
        unregister: async () => true,
      };

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register = async () => registration;
        Object.defineProperty(navigator.serviceWorker, 'ready', {
          configurable: true,
          get: () => Promise.resolve(registration),
        });
        navigator.serviceWorker.getRegistration = async () => registration;
        navigator.serviceWorker.getRegistrations = async () => [registration];
      }

      class MockNotification {
        static permission = permissionValue;

        static requestPermission() {
          MockNotification.permission = 'granted';
          return Promise.resolve('granted');
        }
      }

      window.Notification = MockNotification as typeof Notification;
    },
    {
      permissionValue: permission,
      subscriptionValue: subscription,
    },
  );
}

export async function stubPushApi(
  page: Page,
): Promise<{
  getUpsertCount: () => number;
  getLastUpsertBody: () => PushSubscriptionJson | null;
  getDeleteCount: () => number;
  getLastDeleteBody: () => { endpoint: string } | null;
}> {
  let upsertCount = 0;
  let lastUpsertBody: PushSubscriptionJson | null = null;
  let deleteCount = 0;
  let lastDeleteBody: { endpoint: string } | null = null;

  await page.route('**/api/push/key', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey: TEST_VAPID_PUBLIC_KEY }),
    });
  });

  await page.route('**/api/push/subscriptions', async (route) => {
    if (route.request().method() === 'POST') {
      upsertCount += 1;
      lastUpsertBody = route.request().postDataJSON() as PushSubscriptionJson;
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    if (route.request().method() === 'DELETE') {
      deleteCount += 1;
      lastDeleteBody = route.request().postDataJSON() as { endpoint: string };
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    await route.fallback();
  });

  return {
    getUpsertCount: () => upsertCount,
    getLastUpsertBody: () => lastUpsertBody,
    getDeleteCount: () => deleteCount,
    getLastDeleteBody: () => lastDeleteBody,
  };
}

export async function stubIosSafari(
  page: Page,
  options: { installedPwa?: boolean } = {},
): Promise<void> {
  const installedPwa = options.installedPwa ?? false;

  await page.addInitScript(({ installedPwaValue }) => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () =>
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      get: () => 'iPhone',
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      get: () => 5,
    });

    const originalMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      if (query === '(display-mode: standalone)') {
        return {
          matches: installedPwaValue,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        } as MediaQueryList;
      }

      return originalMatchMedia(query);
    };

    if (installedPwaValue) {
      Object.defineProperty(navigator, 'standalone', {
        configurable: true,
        get: () => true,
      });
    }
  }, { installedPwaValue: installedPwa });
}
