import { STORAGE_KEY_FLAGS } from '@dashboard/shared';
import { expect, test } from '@playwright/test';

import { CLIENT_ROUTE_MANIFEST } from '../src/lib/routes/manifest.js';
import {
  keyboardAdminSession,
  keyboardCatalog,
  keyboardMediaApplication,
  keyboardSession,
  keyboardStatusReport,
  keyboardWarningAlert,
} from './helpers/keyboard-fixtures.js';
import {
  activateFocused,
  assertNoPointerEventsUsed,
  auditKeyboardAccessibility,
  installKeyboardOnlyGuard,
  tabTo,
} from './helpers/keyboard.js';
import { stubPushApi, stubPushEnvironment } from './helpers/push.js';
import {
  readDismissedAlertIds,
  stubAdminAlerts,
  stubAdminPush,
  stubAlerts,
  stubCatalog,
  stubSession,
  stubStatus,
} from './helpers/stubs.js';

async function stubCatalogShell(page: import('@playwright/test').Page) {
  await stubSession(page, keyboardSession);
  await stubCatalog(page, keyboardCatalog);
  await stubStatus(page, keyboardStatusReport);
  await stubAlerts(page, []);
}

async function stubSettingsShell(page: import('@playwright/test').Page) {
  await stubSession(page, keyboardSession);
  await stubCatalog(page, { applications: [keyboardMediaApplication] });
  await stubStatus(page, keyboardStatusReport);
  await stubAlerts(page, []);
}

async function stubAdminShell(
  page: import('@playwright/test').Page,
  options: Parameters<typeof stubAdminAlerts>[1] = {},
) {
  await stubSession(page, keyboardAdminSession);
  await stubStatus(page);
  await stubAdminAlerts(page, options);
}

test.describe('keyboard navigation suite', () => {
  test.beforeEach(async ({ context, page }) => {
    await installKeyboardOnlyGuard(page);
    await context.addInitScript(() => {
      localStorage.clear();
      void navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    });
  });

  test('covers every route from the client manifest', () => {
    expect(CLIENT_ROUTE_MANIFEST.map((entry) => entry.pattern).sort()).toEqual([
      '/',
      '/admin',
      '/apps/:id',
      '/settings',
    ]);
  });

  test.describe('list route', () => {
    test('reaches search, view toggle, rows, and launch links by Tab and activates with Enter', async ({
      page,
    }) => {
      await stubCatalogShell(page);
      await page.route('https://app-one.example/**', async (route) => {
        await route.fulfill({ status: 200, body: 'ok' });
      });
      await page.goto('/');

      await auditKeyboardAccessibility(page);

      const search = page.getByRole('searchbox', { name: 'Search applications' });
      await tabTo(page, search);
      await page.keyboard.type('one');
      await expect(page.getByRole('heading', { name: 'App One', level: 2 })).toBeVisible();

      const gridButton = page.getByRole('button', { name: 'Grid view' });
      await tabTo(page, gridButton);
      await activateFocused(page, 'Enter');
      await expect(page.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      const listButton = page.getByRole('button', { name: 'List view' });
      await tabTo(page, listButton);
      await activateFocused(page, 'Enter');
      await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      const rowLink = page.locator('a.catalog-row__link').filter({ hasText: 'App One' });
      await tabTo(page, rowLink);
      await Promise.all([page.waitForURL('/apps/app-one'), activateFocused(page, 'Enter')]);
      await expect(page.getByRole('heading', { name: 'App One', level: 1 })).toBeVisible();

      await page.goto('/');
      const iconLink = page.getByRole('link', { name: 'Open App One' });
      await tabTo(page, iconLink);
      await Promise.all([
        page.waitForURL('https://app-one.example/'),
        activateFocused(page, 'Enter'),
      ]);

      await assertNoPointerEventsUsed(page);
    });
  });

  test.describe('grid route', () => {
    test('reaches tiles and launch links by Tab and activates with Enter', async ({ page }) => {
      await stubCatalogShell(page);
      await page.goto('/');

      const gridButton = page.getByRole('button', { name: 'Grid view' });
      await tabTo(page, gridButton);
      await activateFocused(page, 'Enter');

      const tileLink = page.locator('a.catalog-tile__link').filter({ hasText: 'App Two' });
      await tabTo(page, tileLink);
      await Promise.all([page.waitForURL('/apps/app-two'), activateFocused(page, 'Enter')]);
      await expect(page.getByRole('heading', { name: 'App Two', level: 1 })).toBeVisible();

      await page.goto('/');
      await page.route('https://app-two.example/**', async (route) => {
        await route.fulfill({ status: 200, body: 'ok' });
      });
      await tabTo(page, gridButton);
      await activateFocused(page, 'Enter');

      const iconLink = page.getByRole('link', { name: 'Open App Two' });
      await tabTo(page, iconLink);
      await Promise.all([
        page.waitForURL('https://app-two.example/'),
        activateFocused(page, 'Enter'),
      ]);

      await assertNoPointerEventsUsed(page);
    });
  });

  test.describe('detail route', () => {
    test('reaches the service list and returns to the list with focus on the catalog heading', async ({
      page,
    }) => {
      await stubCatalogShell(page);
      await page.goto('/apps/media');

      await auditKeyboardAccessibility(page);

      const serviceRows = page.locator('.service-list__button');
      await expect(serviceRows).toHaveCount(3);
      await tabTo(page, serviceRows.nth(0));
      await tabTo(page, serviceRows.nth(1));
      await tabTo(page, serviceRows.nth(2));

      const homeLink = page.getByRole('link', { name: 'Home' });
      await tabTo(page, homeLink);
      await Promise.all([page.waitForURL('/'), activateFocused(page, 'Enter')]);

      await expect(page.getByRole('heading', { name: 'Applications', level: 1 })).toBeFocused();

      await assertNoPointerEventsUsed(page);
    });
  });

  test.describe('settings route', () => {
    test('operates push subscription and feature flag toggles with Enter and Space', async ({
      page,
    }) => {
      await stubPushEnvironment(page, {
        permission: 'default',
        subscription: null,
      });
      await stubSettingsShell(page);
      const pushApi = await stubPushApi(page);
      await page.goto('/settings');

      await auditKeyboardAccessibility(page);

      const subscribeButton = page.getByTestId('settings-push-subscribe');
      await tabTo(page, subscribeButton);
      await activateFocused(page, 'Enter');
      await expect.poll(() => pushApi.getUpsertCount()).toBe(1);

      const popoverToggle = page.getByTestId('feature-flag-dependencySummaryPopover');
      await expect(popoverToggle).not.toBeChecked();
      await tabTo(page, popoverToggle);
      await activateFocused(page, 'Space');
      await expect(popoverToggle).toBeChecked();
      await expect
        .poll(async () =>
          page.evaluate(
            (storageKey) => JSON.parse(localStorage.getItem(storageKey) ?? '{}'),
            STORAGE_KEY_FLAGS,
          ),
        )
        .toEqual({ dependencySummaryPopover: true });

      await activateFocused(page, 'Space');
      await expect(popoverToggle).not.toBeChecked();

      await activateFocused(page, 'Enter');
      await expect(popoverToggle).toBeChecked();

      await activateFocused(page, 'Enter');
      await expect(popoverToggle).not.toBeChecked();

      await assertNoPointerEventsUsed(page);
    });
  });

  test.describe('admin route', () => {
    test('creates, updates, and deletes alerts and sends push by keyboard alone', async ({
      page,
    }) => {
      await stubAdminPush(page);
      await stubAdminShell(page);
      await page.goto('/admin');

      await auditKeyboardAccessibility(page);

      await tabTo(page, page.getByTestId('admin-alert-severity'));
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Tab');
      await page.keyboard.type('Keyboard-only alert');
      await page.keyboard.press('Tab');
      await page.keyboard.type('Created without a mouse.');
      await page.keyboard.press('Tab');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await tabTo(page, page.getByTestId('admin-alerts-submit'));
      await activateFocused(page, 'Enter');
      await expect(page.getByTestId('admin-alert-row-alert-1')).toContainText('Keyboard-only alert');

      await tabTo(page, page.getByTestId(`admin-alert-edit-alert-1`));
      await activateFocused(page, 'Enter');
      await tabTo(page, page.getByTestId('admin-alert-title'));
      await page.keyboard.press('Control+A');
      await page.keyboard.type('Edited by keyboard');
      await tabTo(page, page.getByTestId('admin-alerts-submit'));
      await activateFocused(page, 'Enter');
      await expect(page.getByTestId('admin-alert-row-alert-1')).toContainText('Edited by keyboard');

      await tabTo(page, page.getByTestId('admin-alert-delete-alert-1'));
      await activateFocused(page, 'Enter');
      await tabTo(page, page.getByTestId('admin-alerts-delete-confirm'));
      await activateFocused(page, 'Enter');
      await expect(page.getByTestId('admin-alert-row-alert-1')).toHaveCount(0);

      await tabTo(page, page.getByTestId('admin-push-title'));
      await page.keyboard.type('Keyboard-only push');
      await page.keyboard.press('Tab');
      await page.keyboard.type('Created without a mouse.');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('ArrowDown');
      await tabTo(page, page.getByTestId('admin-push-submit'));
      await activateFocused(page, 'Enter');
      await expect(page.getByTestId('admin-push-attempted')).toBeVisible();

      await assertNoPointerEventsUsed(page);
    });

    test('renders refusal for a non-admin session by keyboard inspection', async ({ page }) => {
      await stubSession(page, keyboardSession);
      await stubStatus(page);
      await page.goto('/admin');

      await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
      await expect(
        page.getByText('You do not have permission to view this page.'),
      ).toBeVisible();

      await assertNoPointerEventsUsed(page);
    });
  });

  test.describe('alert banner', () => {
    test('dismisses by keyboard, writes the id, and focuses the named return target', async ({
      page,
    }) => {
      await stubSession(page, keyboardSession);
      await stubCatalog(page, { applications: [] });
      await stubStatus(page);
      await stubAlerts(page, [keyboardWarningAlert]);
      await page.goto('/');

      const warningBanner = page.getByTestId(`alert-banner-${keyboardWarningAlert.id}`);
      await expect(warningBanner).toBeVisible();

      await tabTo(page, page.getByTestId(`alert-dismiss-${keyboardWarningAlert.id}`));
      await activateFocused(page, 'Enter');

      await expect(warningBanner).not.toBeVisible();
      expect(await readDismissedAlertIds(page)).toEqual([keyboardWarningAlert.id]);
      await expect(page.locator('#alert-dismiss-focus-target')).toBeFocused();

      await assertNoPointerEventsUsed(page);
    });
  });

  test.describe('dependency expander', () => {
    test('toggles on Enter and Space with expanded state in the accessibility tree', async ({
      page,
    }) => {
      await stubCatalogShell(page);
      await page.goto('/');

      const expander = page.locator('.dependency-summary__toggle');
      await expect(expander).toHaveAttribute('aria-expanded', 'false');

      await tabTo(page, expander);
      await activateFocused(page, 'Enter');
      await expect(expander).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('.dependency-summary__service').filter({ hasText: 'Jellyfin' })).toBeVisible();

      await activateFocused(page, 'Enter');
      await expect(expander).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('.dependency-summary__service').filter({ hasText: 'Jellyfin' })).toHaveCount(0);

      await tabTo(page, expander);
      await activateFocused(page, 'Space');
      await expect(expander).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('.dependency-summary__service').filter({ hasText: 'Database' })).toBeVisible();

      await activateFocused(page, 'Space');
      await expect(expander).toHaveAttribute('aria-expanded', 'false');

      await assertNoPointerEventsUsed(page);
    });
  });

  for (const entry of CLIENT_ROUTE_MANIFEST) {
    test(`audits keyboard accessibility on ${entry.pattern}`, async ({ page }) => {
      if (entry.suite === 'admin') {
        await stubAdminShell(page);
      } else if (entry.suite === 'settings') {
        await stubSettingsShell(page);
      } else {
        await stubCatalogShell(page);
      }

      await page.goto(entry.examplePath);
      await auditKeyboardAccessibility(page);
      await assertNoPointerEventsUsed(page);
    });
  }
});
