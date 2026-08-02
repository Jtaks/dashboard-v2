import { expect, test } from '@playwright/test';

import { alertFixture, stubAdminApis, stubKeyboardShell } from './fixtures.js';
import {
  activateWithEnter,
  assertKeyboardReachability,
  assertNoPositiveTabindex,
  tabUntilFocused,
} from './helpers.js';

test.describe('keyboard / admin', () => {
  test('alert create, update, delete and push send with topic selection', async ({ page }) => {
    await stubKeyboardShell(page, { admin: true });
    await stubAdminApis(page, {
      initialAlerts: [
        alertFixture({
          id: 'existing',
          title: 'Existing alert',
          severity: 'info',
          topic: 'media-users',
        }),
      ],
      pushResult: { attempted: 2, failed: 0 },
    });

    await page.goto('/admin');
    await expect(page.getByTestId('admin-page')).toBeVisible();
    await assertNoPositiveTabindex(page);

    // --- Create ---
    await tabUntilFocused(page, page.getByTestId('admin-alert-new'));
    await activateWithEnter(page);
    await expect(page.getByTestId('admin-alert-form')).toBeVisible();

    await tabUntilFocused(page, page.getByTestId('admin-alert-severity'));
    await page.keyboard.press('Alt+ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await tabUntilFocused(page, page.getByTestId('admin-alert-topic'));
    await page.keyboard.press('End'); // *

    await tabUntilFocused(page, page.getByTestId('admin-alert-title'));
    await page.keyboard.type('Keyboard created');

    await tabUntilFocused(page, page.getByTestId('admin-alert-submit'));
    await activateWithEnter(page);

    const list = page.getByTestId('admin-alerts-list');
    await expect(list.getByTestId('admin-alert-row')).toHaveCount(2);
    await expect(
      list.getByTestId('admin-alert-row-title').filter({ hasText: 'Keyboard created' }),
    ).toBeVisible();

    // --- Update ---
    const createdRow = list
      .locator('[data-testid="admin-alert-row"]')
      .filter({ hasText: 'Keyboard created' });
    await tabUntilFocused(page, createdRow.getByTestId('admin-alert-edit'));
    await activateWithEnter(page);
    await expect(page.getByTestId('admin-alert-form')).toHaveAttribute('data-mode', 'edit');

    await tabUntilFocused(page, page.getByTestId('admin-alert-title'));
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Keyboard updated');
    await tabUntilFocused(page, page.getByTestId('admin-alert-submit'));
    await activateWithEnter(page);

    await expect(
      list.getByTestId('admin-alert-row-title').filter({ hasText: 'Keyboard updated' }),
    ).toBeVisible();

    // --- Delete ---
    const updatedRow = list
      .locator('[data-testid="admin-alert-row"]')
      .filter({ hasText: 'Keyboard updated' });
    await tabUntilFocused(page, updatedRow.getByTestId('admin-alert-delete'));
    await activateWithEnter(page);
    await expect(page.getByTestId('admin-alert-delete-confirm')).toBeVisible();
    await tabUntilFocused(page, page.getByTestId('admin-alert-delete-confirm-btn'));
    await activateWithEnter(page);
    await expect(list.getByTestId('admin-alert-row')).toHaveCount(1);
    await expect(list.getByTestId('admin-alert-row-title')).toHaveText('Existing alert');

    // --- Push send with topic selection ---
    await tabUntilFocused(page, page.getByTestId('admin-push-topic'));
    await page.keyboard.press('End');
    await tabUntilFocused(page, page.getByTestId('admin-push-title'));
    await page.keyboard.type('Keyboard push');
    await tabUntilFocused(page, page.getByTestId('admin-push-body'));
    await page.keyboard.type('Push body');
    await tabUntilFocused(page, page.getByTestId('admin-push-submit'));
    await activateWithEnter(page);
    await expect(page.getByTestId('admin-push-result')).toHaveText('Attempted 2. Failed 0.');

    await assertKeyboardReachability(page);
  });

  test('non-admin sees 403 refusal, not admin forms', async ({ page }) => {
    // Session claims admin so the route renders, but admin APIs refuse — real 403 UI.
    await stubKeyboardShell(page, { admin: true });
    await stubAdminApis(page, { topicsStatus: 403, alertsStatus: 403, pushStatus: 403 });

    await page.goto('/admin');

    await expect(page.getByTestId('forbidden')).toBeVisible();
    await expect(page.getByTestId('admin-alert-form')).toHaveCount(0);
    await expect(page.getByTestId('admin-alert-new')).toHaveCount(0);
    await expect(page.getByTestId('admin-push-form')).toHaveCount(0);
    await expect(page.getByTestId('signed-out')).toHaveCount(0);
  });
});
