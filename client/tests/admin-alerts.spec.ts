import type { Alert, Severity } from '@dashboard/shared';
import { expect, test, type Page, type Route } from '@playwright/test';

const logoutUrl = 'https://auth.example.test/logout';

const topics = ['media-users', 'docs-users', '*'];

function sessionBody(admin: boolean) {
  return {
    name: 'Test User',
    email: 'test@example.com',
    admin,
    logoutUrl,
  };
}

function alertFixture(overrides: Partial<Alert> & Pick<Alert, 'id' | 'title'>): Alert {
  return {
    severity: 'info',
    body: null,
    topic: '*',
    endsAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

async function stubSession(page: Page, admin: boolean) {
  await page.route('**/api/session', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionBody(admin)),
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

type AdminStubOptions = {
  topicsStatus?: number;
  alertsStatus?: number;
  initialAlerts?: Alert[];
  rejectCreate?: boolean;
};

async function stubAdminApi(page: Page, options: AdminStubOptions = {}) {
  const {
    topicsStatus = 200,
    alertsStatus = 200,
    initialAlerts = [],
    rejectCreate = false,
  } = options;

  let alerts = [...initialAlerts];
  let nextId = 1;

  await page.route('**/api/admin/topics', async (route) => {
    await route.fulfill({
      status: topicsStatus,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(topicsStatus >= 400 ? { code: 'forbidden' } : topics),
    });
  });

  await page.route('**/api/admin/alerts**', async (route: Route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    const idMatch = path.match(/\/api\/admin\/alerts\/([^/]+)$/);

    if (method === 'GET' && path.endsWith('/api/admin/alerts')) {
      await route.fulfill({
        status: alertsStatus,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertsStatus >= 400 ? { code: 'forbidden' } : alerts),
      });
      return;
    }

    if (method === 'POST' && path.endsWith('/api/admin/alerts')) {
      if (rejectCreate) {
        await route.fulfill({
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'invalid_body' }),
        });
        return;
      }
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
      await route.fulfill({
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(created),
      });
      return;
    }

    if (idMatch && method === 'PATCH') {
      const id = decodeURIComponent(idMatch[1]!);
      const patch = request.postDataJSON() as Partial<Alert>;
      const index = alerts.findIndex((a) => a.id === id);
      if (index < 0) {
        await route.fulfill({
          status: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'not_found' }),
        });
        return;
      }
      const updated = { ...alerts[index]!, ...patch, id };
      alerts = alerts.map((a) => (a.id === id ? updated : a));
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      return;
    }

    if (idMatch && method === 'DELETE') {
      const id = decodeURIComponent(idMatch[1]!);
      const before = alerts.length;
      alerts = alerts.filter((a) => a.id !== id);
      if (alerts.length === before) {
        await route.fulfill({
          status: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'not_found' }),
        });
        return;
      }
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    await route.fulfill({
      status: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'not_found' }),
    });
  });
}

test('topic options come exactly from the admin topics API including *', async ({ page }) => {
  await stubSession(page, true);
  await stubStatus(page);
  await stubAdminApi(page);

  await page.goto('/admin');
  await page.getByTestId('admin-alert-new').click();

  const options = page.getByTestId('admin-alert-topic').locator('option');
  await expect(options).toHaveCount(topics.length);
  await expect(options).toHaveText(topics);
});

test('forced admin session with stubbed 403 shows refusal not the form', async ({ page }) => {
  // Client-side admin flag forced on (session.admin true) while the API refuses.
  await stubSession(page, true);
  await stubStatus(page);
  await stubAdminApi(page, { topicsStatus: 403, alertsStatus: 403 });

  await page.goto('/admin');

  await expect(page.getByTestId('forbidden')).toBeVisible();
  await expect(page.getByTestId('admin-alert-form')).toHaveCount(0);
  await expect(page.getByTestId('admin-alert-new')).toHaveCount(0);
  await expect(page.getByTestId('signed-out')).toHaveCount(0);
});

test('create, edit, and delete update the list without reload; delete needs confirm', async ({
  page,
}) => {
  await stubSession(page, true);
  await stubStatus(page);
  await stubAdminApi(page, {
    initialAlerts: [
      alertFixture({
        id: 'existing',
        title: 'Existing alert',
        severity: 'warning',
        topic: 'media-users',
        endsAt: '2025-01-01T00:00:00.000Z',
      }),
    ],
  });

  await page.goto('/admin');

  const list = page.getByTestId('admin-alerts-list');
  await expect(list.getByTestId('admin-alert-row')).toHaveCount(1);
  await expect(page.getByTestId('admin-alert-row-title')).toHaveText('Existing alert');
  await expect(page.getByTestId('admin-alert-row-severity')).toHaveText('Warning');
  await expect(page.getByTestId('admin-alert-row-topic')).toHaveText('media-users');
  await expect(page.getByTestId('admin-alert-row-ends-at')).toHaveText('2025-01-01T00:00:00.000Z');

  await page.getByTestId('admin-alert-new').click();
  await page.getByTestId('admin-alert-severity').selectOption('error');
  await page.getByTestId('admin-alert-topic').selectOption('*');
  await page.getByTestId('admin-alert-title').fill('New outage');
  await page.getByTestId('admin-alert-body').fill('Details');
  await page.getByTestId('admin-alert-submit').click();

  await expect(list.getByTestId('admin-alert-row')).toHaveCount(2);
  await expect(list.getByTestId('admin-alert-row-title').filter({ hasText: 'New outage' })).toBeVisible();
  await expect(page.getByTestId('admin-alert-form')).toHaveCount(0);

  const createdRow = () =>
    list.locator('[data-testid="admin-alert-row"]').filter({ hasText: 'New outage' });
  await createdRow().getByTestId('admin-alert-edit').click();
  await expect(page.getByTestId('admin-alert-form')).toHaveAttribute('data-mode', 'edit');
  await page.getByTestId('admin-alert-title').fill('Renamed outage');
  await page.getByTestId('admin-alert-submit').click();

  await expect(list.getByTestId('admin-alert-row-title').filter({ hasText: 'Renamed outage' })).toBeVisible();
  await expect(list.getByTestId('admin-alert-row-title').filter({ hasText: 'New outage' })).toHaveCount(0);

  const renamedRow = list
    .locator('[data-testid="admin-alert-row"]')
    .filter({ hasText: 'Renamed outage' });
  await renamedRow.getByTestId('admin-alert-delete').click();
  await expect(page.getByTestId('admin-alert-delete-confirm')).toBeVisible();
  // Still present until confirm — list not mutated by the request alone.
  await expect(list.getByTestId('admin-alert-row-title').filter({ hasText: 'Renamed outage' })).toBeVisible();

  await page.getByTestId('admin-alert-delete-confirm-btn').click();
  await expect(list.getByTestId('admin-alert-row')).toHaveCount(1);
  await expect(list.getByTestId('admin-alert-row-title')).toHaveText('Existing alert');
  await expect(page.getByTestId('admin-alert-delete-confirm')).toHaveCount(0);
});

test('validation rejection shows a catalog message not raw response text', async ({ page }) => {
  await stubSession(page, true);
  await stubStatus(page);
  await stubAdminApi(page, { rejectCreate: true });

  await page.goto('/admin');
  await page.getByTestId('admin-alert-new').click();
  await page.getByTestId('admin-alert-title').fill('Bad');
  await page.getByTestId('admin-alert-submit').click();

  await expect(page.getByTestId('admin-alert-form-error')).toHaveText(
    'The alert could not be saved. Check the fields and try again.',
  );
  await expect(page.getByText('invalid_body')).toHaveCount(0);
});

test('create flow is completable by keyboard alone', async ({ page }) => {
  await stubSession(page, true);
  await stubStatus(page);
  await stubAdminApi(page);

  await page.goto('/admin');

  await page.getByTestId('admin-alert-new').focus();
  await expect(page.getByTestId('admin-alert-new')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('admin-alert-form')).toBeVisible();

  await page.getByTestId('admin-alert-severity').focus();
  await page.keyboard.press('Alt+ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await page.getByTestId('admin-alert-topic').focus();
  // Move to the last option (*) — topics are media-users, docs-users, *.
  await page.keyboard.press('End');

  await page.getByTestId('admin-alert-title').focus();
  await page.keyboard.type('Keyboard alert');

  await page.getByTestId('admin-alert-submit').focus();
  await expect(page.getByTestId('admin-alert-submit')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('admin-alerts-list').getByTestId('admin-alert-row')).toHaveCount(1);
  await expect(page.getByTestId('admin-alert-row-title')).toHaveText('Keyboard alert');
  await expect(page.getByTestId('admin-alert-row-topic')).toHaveText('*');
});
