import type {
  Alert,
  Catalog,
  PushResult,
  PushSend,
  Severity,
  StatusReport,
} from '@dashboard/shared';
import { STORAGE_KEYS } from '@dashboard/shared';
import type { Page, Route } from '@playwright/test';

export const logoutUrl = 'https://auth.example.test/logout';

export const adminTopics = ['media-users', 'docs-users', '*'] as const;

export function sessionBody(admin: boolean) {
  return {
    name: 'Test User',
    email: 'test@example.com',
    admin,
    logoutUrl,
  };
}

export const catalogThreeApps: Catalog = {
  applications: [
    {
      id: 'media',
      name: 'Media',
      description: 'Films and series.',
      url: 'https://media.example.test/',
      icon: 'media.svg',
      requestable: false,
      services: [
        { id: 'jellyfin', name: 'Jellyfin', hasContainers: true },
        { id: 'postgres', name: 'Postgres', hasContainers: true },
        { id: 'docs', name: 'Docs link', hasContainers: false },
      ],
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

export const statusWithMedia: StatusReport = {
  collectedAt: '2026-01-04T00:00:00.000Z',
  applications: [
    {
      id: 'media',
      status: 'degraded',
      since: '2026-01-03T00:00:00.000Z',
      services: [
        { id: 'jellyfin', status: 'up', since: '2026-01-01T00:00:00.000Z' },
        { id: 'postgres', status: 'degraded', since: '2026-01-03T00:00:00.000Z' },
        { id: 'docs', status: null, since: null },
      ],
    },
    {
      id: 'docs',
      status: null,
      since: null,
      services: [],
    },
    {
      id: 'mail',
      status: null,
      since: null,
      services: [],
    },
  ],
};

export function alertFixture(overrides: Partial<Alert> & Pick<Alert, 'id' | 'title'>): Alert {
  return {
    severity: 'warning',
    body: 'Please read this.',
    topic: '*',
    endsAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const fakeEndpoint = 'https://push.example.test/subscriptions/keyboard-1';
const fakeKeys = { p256dh: 'BPtest-p256dh-key-value', auth: 'test-auth-key' };
const fakePublicKey = 'BPabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV';

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function stubSession(page: Page, admin = false) {
  await page.route('**/api/session', async (route) => {
    await fulfillJson(route, 200, sessionBody(admin));
  });
}

export async function stubCatalog(page: Page, body: Catalog = catalogThreeApps) {
  await page.route('**/api/catalog', async (route) => {
    await fulfillJson(route, 200, body);
  });
}

export async function stubStatus(page: Page, body: StatusReport = statusWithMedia) {
  await page.route('**/api/status', async (route) => {
    await fulfillJson(route, 200, body);
  });
}

export async function stubAlerts(page: Page, alerts: Alert[] = []) {
  await page.route('**/api/alerts', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/admin/')) {
      await route.continue();
      return;
    }
    await fulfillJson(route, 200, alerts);
  });
}

/** Suppress the in-page push permission prompt so it does not steal tab stops. */
export async function dismissPushPromptInStorage(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'dismissed');
  }, STORAGE_KEYS.pushPrompt);
}

export type KeyboardShellOptions = {
  admin?: boolean;
  catalog?: Catalog;
  status?: StatusReport;
  alerts?: Alert[];
  /** When true, leave push prompt storage alone (default suppresses it). */
  allowPushPrompt?: boolean;
};

/** Stub the signed-in shell APIs used by every keyboard route walk. */
export async function stubKeyboardShell(page: Page, options: KeyboardShellOptions = {}) {
  const {
    admin = false,
    catalog = catalogThreeApps,
    status = statusWithMedia,
    alerts = [],
    allowPushPrompt = false,
  } = options;

  if (!allowPushPrompt) {
    await dismissPushPromptInStorage(page);
  }

  await stubSession(page, admin);
  await stubCatalog(page, catalog);
  await stubStatus(page, status);
  await stubAlerts(page, alerts);
}

export type AdminStubOptions = {
  topicsStatus?: number;
  alertsStatus?: number;
  pushStatus?: number;
  initialAlerts?: Alert[];
  pushResult?: PushResult;
};

export async function stubAdminApis(page: Page, options: AdminStubOptions = {}) {
  const {
    topicsStatus = 200,
    alertsStatus = 200,
    pushStatus = 200,
    initialAlerts = [],
    pushResult = { attempted: 1, failed: 0 },
  } = options;

  let alerts = [...initialAlerts];
  let nextId = 1;
  let lastPushBody: PushSend | null = null;

  await page.route('**/api/admin/topics', async (route) => {
    await fulfillJson(
      route,
      topicsStatus,
      topicsStatus >= 400 ? { code: 'forbidden' } : [...adminTopics],
    );
  });

  await page.route('**/api/admin/alerts**', async (route: Route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    const idMatch = path.match(/\/api\/admin\/alerts\/([^/]+)$/);

    if (method === 'GET' && path.endsWith('/api/admin/alerts')) {
      await fulfillJson(route, alertsStatus, alertsStatus >= 400 ? { code: 'forbidden' } : alerts);
      return;
    }

    if (method === 'POST' && path.endsWith('/api/admin/alerts')) {
      const body = request.postDataJSON() as {
        severity: Severity;
        title: string;
        body?: string | null;
        topic: string;
        endsAt?: string | null;
      };
      const created = alertFixture({
        id: `alert-${nextId++}`,
        severity: body.severity,
        title: body.title,
        body: body.body ?? null,
        topic: body.topic,
        endsAt: body.endsAt ?? null,
        createdAt: new Date().toISOString(),
      });
      alerts = [created, ...alerts];
      await fulfillJson(route, 201, created);
      return;
    }

    if (idMatch && method === 'PATCH') {
      const id = decodeURIComponent(idMatch[1]!);
      const patch = request.postDataJSON() as Partial<Alert>;
      const index = alerts.findIndex((a) => a.id === id);
      if (index < 0) {
        await fulfillJson(route, 404, { code: 'not_found' });
        return;
      }
      const updated = { ...alerts[index]!, ...patch, id };
      alerts = alerts.map((a) => (a.id === id ? updated : a));
      await fulfillJson(route, 200, updated);
      return;
    }

    if (idMatch && method === 'DELETE') {
      const id = decodeURIComponent(idMatch[1]!);
      const before = alerts.length;
      alerts = alerts.filter((a) => a.id !== id);
      if (alerts.length === before) {
        await fulfillJson(route, 404, { code: 'not_found' });
        return;
      }
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    await fulfillJson(route, 404, { code: 'not_found' });
  });

  await page.route('**/api/admin/push', async (route) => {
    if (route.request().method() !== 'POST') {
      await fulfillJson(route, 404, { code: 'not_found' });
      return;
    }
    if (pushStatus >= 400) {
      await fulfillJson(route, pushStatus, {
        code: pushStatus === 403 ? 'forbidden' : 'invalid_body',
      });
      return;
    }
    lastPushBody = route.request().postDataJSON() as PushSend;
    await fulfillJson(route, 200, pushResult);
  });

  return {
    getLastPushBody: () => lastPushBody,
    getAlerts: () => alerts,
  };
}

export async function installPushStubs(page: Page) {
  await page.addInitScript(
    ({ endpoint, keys, publicKey }) => {
      const state = { subscribed: false, permission: 'default' as NotificationPermission };

      const fakeSubscription = {
        endpoint,
        expirationTime: null,
        options: { userVisibleOnly: true, applicationServerKey: null },
        getKey() {
          return null;
        },
        toJSON() {
          return { endpoint, expirationTime: null, keys };
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

      (window as unknown as { __testPushPublicKey?: string }).__testPushPublicKey = publicKey;
    },
    { endpoint: fakeEndpoint, keys: fakeKeys, publicKey: fakePublicKey },
  );
}

export async function stubPushApi(page: Page) {
  const posts: unknown[] = [];
  const deletes: unknown[] = [];

  await page.route('**/api/push/key', async (route) => {
    await fulfillJson(route, 200, { publicKey: fakePublicKey });
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

  return { posts, deletes };
}

export async function stubExternalApp(page: Page, origin: string, heading: string) {
  await page.route(`${origin}/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><title>${heading}</title><h1>${heading}</h1>`,
    });
  });
}
