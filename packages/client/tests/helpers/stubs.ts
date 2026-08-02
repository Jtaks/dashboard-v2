import type { Page } from '@playwright/test';
import type { Alert, Catalog, PushResult, Session, StatusReport } from '@dashboard/shared';
import { STORAGE_KEY_ALERTS_DISMISSED, STORAGE_KEY_FLAGS } from '@dashboard/shared';

export const defaultSession: Session = {
  name: 'Test User',
  email: 'test@example.com',
  admin: false,
  logoutUrl: 'https://auth.example/logout',
};

export const emptyStatusReport: StatusReport = {
  collectedAt: '2026-01-01T12:00:00.000Z',
  applications: [],
};

export async function stubSession(
  page: Page,
  session: Session = defaultSession,
): Promise<void> {
  await page.route('**/api/session', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
  });
}

export async function stubCatalog(page: Page, catalog: Catalog): Promise<void> {
  await page.route('**/api/catalog', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(catalog),
    });
  });
}

export async function stubStatus(
  page: Page,
  report: StatusReport = emptyStatusReport,
): Promise<void> {
  await page.route('**/api/status', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
  });
}

export async function stubAlerts(
  page: Page,
  alerts: Alert[] = [],
): Promise<{ setAlerts: (next: Alert[]) => void }> {
  let currentAlerts = [...alerts];

  await page.route('**/api/alerts', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentAlerts),
    });
  });

  return {
    setAlerts: (next: Alert[]) => {
      currentAlerts = [...next];
    },
  };
}

export async function readDismissedAlertIds(page: Page): Promise<string[]> {
  return page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as string[]) : [];
  }, STORAGE_KEY_ALERTS_DISMISSED);
}

export async function stubAdminTopics(
  page: Page,
  status: number,
  body: Record<string, unknown> = { topics: ['*'] },
): Promise<void> {
  await page.route('**/api/admin/topics', async (route) => {
    await route.fulfill({
      status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  });
}

type AdminAlertsStubOptions = {
  topics?: string[];
  alerts?: Alert[];
  refuse?: boolean;
};

export async function stubAdminAlerts(
  page: Page,
  options: AdminAlertsStubOptions = {},
): Promise<{ getAlerts: () => Alert[] }> {
  const topics = options.topics ?? ['*', 'media-users', 'media-admins'];
  let alerts = [...(options.alerts ?? [])];
  const refuse = options.refuse ?? false;

  await page.route('**/api/admin/topics', async (route) => {
    await route.fulfill({
      status: refuse ? 403 : 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(refuse ? { code: 'forbidden' } : { topics }),
    });
  });

  await page.route('**/api/admin/alerts', async (route) => {
    if (refuse) {
      await route.fulfill({
        status: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'forbidden' }),
      });
      return;
    }

    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alerts),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Omit<Alert, 'id' | 'createdAt'>;
      const created: Alert = {
        id: `alert-${alerts.length + 1}`,
        createdAt: new Date().toISOString(),
        ...body,
      };
      alerts = [created, ...alerts];
      await route.fulfill({
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(created),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/api/admin/alerts/*', async (route) => {
    if (refuse) {
      await route.fulfill({
        status: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'forbidden' }),
      });
      return;
    }

    const id = route.request().url().split('/').pop() ?? '';

    if (route.request().method() === 'PATCH') {
      const patch = route.request().postDataJSON() as Partial<Alert>;
      const index = alerts.findIndex((alert) => alert.id === id);
      if (index === -1) {
        await route.fulfill({
          status: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'not_found' }),
        });
        return;
      }

      const updated: Alert = {
        ...alerts[index],
        ...patch,
        id,
      };
      alerts = alerts.map((alert) => (alert.id === id ? updated : alert));
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      return;
    }

    if (route.request().method() === 'DELETE') {
      const existed = alerts.some((alert) => alert.id === id);
      alerts = alerts.filter((alert) => alert.id !== id);
      await route.fulfill({
        status: existed ? 204 : 404,
        headers: { 'Content-Type': 'application/json' },
        body: existed ? '' : JSON.stringify({ code: 'not_found' }),
      });
      return;
    }

    await route.fallback();
  });

  return {
    getAlerts: () => alerts,
  };
}

type AdminPushStubOptions = {
  topics?: string[];
  refuse?: boolean;
  pushResult?: PushResult;
};

export async function stubAdminPush(
  page: Page,
  options: AdminPushStubOptions = {},
): Promise<{ getLastPushBody: () => Record<string, unknown> | null }> {
  const topics = options.topics ?? ['*', 'media-users', 'media-admins'];
  const refuse = options.refuse ?? false;
  const pushResult = options.pushResult ?? { attempted: 3, failed: 1 };
  let lastPushBody: Record<string, unknown> | null = null;

  await page.route('**/api/admin/topics', async (route) => {
    await route.fulfill({
      status: refuse ? 403 : 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(refuse ? { code: 'forbidden' } : { topics }),
    });
  });

  await page.route('**/api/admin/push', async (route) => {
    if (refuse) {
      await route.fulfill({
        status: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'forbidden' }),
      });
      return;
    }

    lastPushBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pushResult),
    });
  });

  return {
    getLastPushBody: () => lastPushBody,
  };
}

export async function setFeatureFlag(page: Page, name: string, enabled: boolean): Promise<void> {
  await page.evaluate(
    ({ storageKey, flagName, value }) => {
      const raw = localStorage.getItem(storageKey);
      const flags = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      flags[flagName] = value;
      localStorage.setItem(storageKey, JSON.stringify(flags));
      window.dispatchEvent(new Event('dashboard-flags-changed'));
    },
    { storageKey: STORAGE_KEY_FLAGS, flagName: name, value: enabled },
  );
}
