import { STORAGE_KEYS } from '@dashboard/shared';
import { expect, test } from '@playwright/test';

import { stubExternalApp, stubKeyboardShell } from './fixtures.js';
import {
  activateWithEnter,
  assertKeyboardReachability,
  assertNoPositiveTabindex,
  tabUntilFocused,
} from './helpers.js';

test.describe('keyboard / grid', () => {
  test('Tab reaches search, view toggle, every tile and launch link; Enter activates', async ({
    page,
  }) => {
    await stubKeyboardShell(page);
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'grid');
    }, STORAGE_KEYS.view);
    await stubExternalApp(page, 'https://mail.example.test', 'mail app');

    await page.goto('/');
    await expect(page.getByTestId('catalog-grid')).toBeVisible();

    await assertNoPositiveTabindex(page);

    await tabUntilFocused(page, page.getByTestId('catalog-search-input'));
    await tabUntilFocused(page, page.getByTestId('catalog-view-list'));
    await tabUntilFocused(page, page.getByTestId('catalog-view-grid'));

    const tiles = page.getByTestId('application-tile');
    await expect(tiles).toHaveCount(3);

    for (let i = 0; i < 3; i += 1) {
      const tile = tiles.nth(i);
      await tabUntilFocused(page, tile.getByTestId('application-icon-link'));
      await tabUntilFocused(page, tile.getByTestId('application-detail-link'));
      if (i === 0) {
        await tabUntilFocused(page, tile.getByTestId('status-summary-expander'));
      }
    }

    await assertKeyboardReachability(page);

    // Enter on a tile detail link opens the detail route.
    const mediaDetail = tiles.nth(0).getByTestId('application-detail-link');
    await tabUntilFocused(page, mediaDetail);
    await activateWithEnter(page);
    await expect(page).toHaveURL(/\/applications\/media$/);
    await expect(page.getByTestId('application-detail')).toBeVisible();

    // Return and activate a launch link from the grid.
    await page.goto('/');
    await expect(page.getByTestId('catalog-grid')).toBeVisible();
    const mailIcon = tiles.nth(2).getByTestId('application-icon-link');
    await tabUntilFocused(page, mailIcon);
    await Promise.all([page.waitForURL('https://mail.example.test/'), activateWithEnter(page)]);
    await expect(page.getByRole('heading', { name: 'mail app' })).toBeVisible();
  });
});
