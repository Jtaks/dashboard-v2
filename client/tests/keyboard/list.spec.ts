import { expect, test } from '@playwright/test';

import { stubExternalApp, stubKeyboardShell } from './fixtures.js';
import {
  activateWithEnter,
  assertKeyboardReachability,
  assertNoPositiveTabindex,
  tabUntilFocused,
} from './helpers.js';

test.describe('keyboard / list', () => {
  test('Tab reaches search, view toggle, every row and launch link; Enter activates', async ({
    page,
  }) => {
    await stubKeyboardShell(page);
    await stubExternalApp(page, 'https://docs.example.test', 'docs app');

    await page.goto('/');
    await expect(page.getByTestId('catalog-list')).toBeVisible();

    await assertNoPositiveTabindex(page);

    // Reading order: chrome → search → view toggle → per row (icon / detail / expander).
    await tabUntilFocused(page, page.getByTestId('catalog-search-input'));
    await expect(page.getByTestId('catalog-search-input')).toBeFocused();

    await tabUntilFocused(page, page.getByTestId('catalog-view-list'));
    await tabUntilFocused(page, page.getByTestId('catalog-view-grid'));

    const rows = page.getByTestId('application-row');
    await expect(rows).toHaveCount(3);

    for (let i = 0; i < 3; i += 1) {
      const row = rows.nth(i);
      await tabUntilFocused(page, row.getByTestId('application-icon-link'));
      await tabUntilFocused(page, row.getByTestId('application-detail-link'));
      if (i === 0) {
        // Media row carries the dependency expander in the tab order.
        await tabUntilFocused(page, row.getByTestId('status-summary-expander'));
      }
    }

    await assertKeyboardReachability(page);

    // Enter on the detail link (row activation) opens the detail route.
    const mediaDetail = rows.nth(0).getByTestId('application-detail-link');
    await tabUntilFocused(page, mediaDetail);
    await activateWithEnter(page);
    await expect(page).toHaveURL(/\/applications\/media$/);
    await expect(page.getByTestId('application-detail')).toBeVisible();

    // Return and activate a launch (icon) link.
    await page.goto('/');
    await expect(page.getByTestId('catalog-list')).toBeVisible();
    const docsIcon = rows.nth(1).getByTestId('application-icon-link');
    await tabUntilFocused(page, docsIcon);
    await Promise.all([page.waitForURL('https://docs.example.test/'), activateWithEnter(page)]);
    await expect(page.getByRole('heading', { name: 'docs app' })).toBeVisible();
  });
});
