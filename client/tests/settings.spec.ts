import { expect, test, type Page } from '@playwright/test';
import { STORAGE_KEYS } from '@dashboard/shared';

const logoutUrl = 'https://auth.example.test/logout';

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

async function stubAdminTopics(page: Page, status: number, body: unknown = ['*']) {
  await page.route('**/api/admin/topics', async (route) => {
    await route.fulfill({
      status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(status >= 400 ? { code: 'forbidden' } : body),
    });
  });
}

test('cog is keyboard reachable and activatable to the settings route', async ({ page }) => {
  await stubSession(page, false);

  await page.goto('/');

  const cog = page.getByTestId('nav-settings');
  await expect(cog).toBeVisible();
  await expect(cog).toHaveAttribute('href', '/settings');

  await page.getByRole('link', { name: 'dashboard' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Applications' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cog).toBeFocused();

  await Promise.all([page.waitForURL('**/settings'), page.keyboard.press('Enter')]);
  await expect(page.getByTestId('settings-page')).toBeVisible();
  await expect(page.getByTestId('settings-section-notifications')).toBeVisible();
  await expect(page.getByTestId('settings-section-flags')).toBeVisible();
});

test('admin section is absent when session admin is false', async ({ page }) => {
  await stubSession(page, false);

  await page.goto('/settings');

  await expect(page.getByTestId('settings-page')).toBeVisible();
  await expect(page.getByTestId('settings-section-admin')).toHaveCount(0);
  await expect(page.getByTestId('settings-admin-ready')).toHaveCount(0);
});

test('admin section renders when session admin is true', async ({ page }) => {
  await stubSession(page, true);
  await stubAdminTopics(page, 200, ['media-users', '*']);

  await page.goto('/settings');

  await expect(page.getByTestId('settings-section-admin')).toBeVisible();
  // Empty marker has no box; assert attachment after a successful admin probe.
  await expect(page.getByTestId('settings-admin-ready')).toBeAttached();
  await expect(page.getByTestId('forbidden')).toHaveCount(0);
});

test('admin endpoint 403 renders the A6 refusal state in the admin section', async ({ page }) => {
  await stubSession(page, true);
  await stubAdminTopics(page, 403);

  await page.goto('/settings');

  await expect(page.getByTestId('settings-section-admin')).toBeVisible();
  await expect(page.getByTestId('forbidden')).toBeVisible();
  await expect(page.getByTestId('settings-admin-ready')).toHaveCount(0);
  await expect(page.getByTestId('signed-out')).toHaveCount(0);
});

test('settings route is usable at mobile width without horizontal scroll', async ({ page }) => {
  await stubSession(page, false);
  await page.setViewportSize({ width: 320, height: 640 });

  await page.goto('/settings');

  await expect(page.getByTestId('settings-page')).toBeVisible();

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
});

test('non-admin sees only non-admin flags; admin sees admin flags too', async ({ page }) => {
  await stubSession(page, false);
  await page.goto('/settings');

  await expect(page.getByTestId('settings-flag-status-summary-popover')).toBeVisible();
  await expect(page.getByTestId('settings-flag-admin-status-detail')).toHaveCount(0);

  await stubSession(page, true);
  await stubAdminTopics(page, 200, ['*']);
  await page.goto('/settings');

  await expect(page.getByTestId('settings-flag-status-summary-popover')).toBeVisible();
  await expect(page.getByTestId('settings-flag-admin-status-detail')).toBeVisible();
});

test('feature flag keyboard toggle updates subscribers, storage, and survives reload', async ({
  page,
}) => {
  await stubSession(page, false);
  await page.goto('/settings');

  const toggle = page.getByTestId('settings-flag-toggle-status-summary-popover');
  const probe = page.getByTestId('flag-status-summary-popover-state');

  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(probe).toHaveAttribute('data-enabled', 'false');

  await toggle.focus();
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Space');

  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(probe).toHaveAttribute('data-enabled', 'true');

  await expect
    .poll(async () =>
      page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.flags),
    )
    .toBe(JSON.stringify({ 'status-summary-popover': true }));

  // Re-stub before reload so the session route stays fulfilled.
  await stubSession(page, false);
  await page.reload();

  await expect(page.getByTestId('settings-page')).toBeVisible();
  await expect(
    page.getByTestId('settings-flag-toggle-status-summary-popover'),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('flag-status-summary-popover-state')).toHaveAttribute(
    'data-enabled',
    'true',
  );
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.flags)).toBe(
    JSON.stringify({ 'status-summary-popover': true }),
  );
});

test('list and grid are not among the feature flags', async ({ page }) => {
  await stubSession(page, true);
  await stubAdminTopics(page, 200, ['*']);
  await page.goto('/settings');

  await expect(page.getByTestId('settings-flags-list')).toBeVisible();
  await expect(page.getByTestId('settings-flag-list')).toHaveCount(0);
  await expect(page.getByTestId('settings-flag-grid')).toHaveCount(0);
  await expect(page.getByTestId('settings-flag-view')).toHaveCount(0);
});
