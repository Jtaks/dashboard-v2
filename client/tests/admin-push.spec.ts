import type { PushResult, PushSend } from '@dashboard/shared';
import { expect, test, type Page } from '@playwright/test';

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

type PushStubOptions = {
  topicsStatus?: number;
  pushStatus?: number;
  pushResult?: PushResult;
};

async function stubAdminPushApi(page: Page, options: PushStubOptions = {}) {
  const {
    topicsStatus = 200,
    pushStatus = 200,
    pushResult = { attempted: 3, failed: 1 },
  } = options;

  let lastBody: PushSend | null = null;

  await page.route('**/api/alerts', async (route) => {
    if (route.request().method() === 'GET' && !route.request().url().includes('/admin/')) {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/admin/topics', async (route) => {
    await route.fulfill({
      status: topicsStatus,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(topicsStatus >= 400 ? { code: 'forbidden' } : topics),
    });
  });

  await page.route('**/api/admin/alerts**', async (route) => {
    await route.fulfill({
      status: topicsStatus >= 400 ? topicsStatus : 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(topicsStatus >= 400 ? { code: 'forbidden' } : []),
    });
  });

  await page.route('**/api/admin/push', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'not_found' }),
      });
      return;
    }

    if (pushStatus >= 400) {
      await route.fulfill({
        status: pushStatus,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pushStatus === 403 ? 'forbidden' : 'invalid_body' }),
      });
      return;
    }

    lastBody = route.request().postDataJSON() as PushSend;
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pushResult),
    });
  });

  return {
    getLastBody: () => lastBody,
  };
}

test('push compose shows stubbed counts after send', async ({ page }) => {
  await stubSession(page, true);
  await stubStatus(page);
  const api = await stubAdminPushApi(page, { pushResult: { attempted: 5, failed: 2 } });

  await page.goto('/admin');

  await page.getByTestId('admin-push-topic').selectOption('*');
  await page.getByTestId('admin-push-title').fill('Outage');
  await page.getByTestId('admin-push-body').fill('Details here');
  await page.getByTestId('admin-push-url').fill('/apps/media');
  await page.getByTestId('admin-push-submit').click();

  await expect(page.getByTestId('admin-push-result')).toHaveText('Attempted 5. Failed 2.');
  expect(api.getLastBody()).toEqual({
    title: 'Outage',
    body: 'Details here',
    url: '/apps/media',
    topic: '*',
  });
});

test('push compose flow is completable by keyboard alone', async ({ page }) => {
  await stubSession(page, true);
  await stubStatus(page);
  await stubAdminPushApi(page, { pushResult: { attempted: 1, failed: 0 } });

  await page.goto('/admin');

  await page.getByTestId('admin-push-topic').focus();
  await expect(page.getByTestId('admin-push-topic')).toBeFocused();
  // topics: media-users, docs-users, * — End selects *
  await page.keyboard.press('End');

  await page.getByTestId('admin-push-title').focus();
  await page.keyboard.type('Keyboard push');

  await page.getByTestId('admin-push-body').focus();
  await page.keyboard.type('Body text');

  await page.getByTestId('admin-push-submit').focus();
  await expect(page.getByTestId('admin-push-submit')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('admin-push-result')).toHaveText('Attempted 1. Failed 0.');
});

test('forced admin session with stubbed push 403 shows refusal not the form', async ({ page }) => {
  await stubSession(page, true);
  await stubStatus(page);
  await stubAdminPushApi(page, { pushStatus: 403 });

  await page.goto('/admin');

  await page.getByTestId('admin-push-title').fill('Nope');
  await page.getByTestId('admin-push-body').fill('Nope');
  await page.getByTestId('admin-push-submit').click();

  await expect(page.getByTestId('forbidden')).toBeVisible();
  await expect(page.getByTestId('admin-push-form')).toHaveCount(0);
  await expect(page.getByTestId('admin-alert-form')).toHaveCount(0);
  await expect(page.getByTestId('signed-out')).toHaveCount(0);
});

test('topics 403 shows refusal instead of the push form', async ({ page }) => {
  await stubSession(page, true);
  await stubStatus(page);
  await stubAdminPushApi(page, { topicsStatus: 403 });

  await page.goto('/admin');

  await expect(page.getByTestId('forbidden')).toBeVisible();
  await expect(page.getByTestId('admin-push-form')).toHaveCount(0);
  await expect(page.getByTestId('admin-push')).toHaveCount(0);
});
