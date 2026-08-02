import { STORAGE_KEYS } from '@dashboard/shared';
import { expect, test } from '@playwright/test';

import { alertFixture, stubKeyboardShell } from './fixtures.js';
import { activateWithEnter, assertNoPositiveTabindex, tabUntilFocused } from './helpers.js';

test.describe('keyboard / alert banner', () => {
  test('dismiss by keyboard removes banner, stores id, and moves focus to named element', async ({
    page,
  }) => {
    const alerts = [alertFixture({ id: 'alert-kbd-suite', title: 'Keyboard dismiss', body: null })];
    await stubKeyboardShell(page, { alerts });

    await page.goto('/');
    const banner = page.getByTestId('alert-banner');
    await expect(banner).toBeVisible();

    await assertNoPositiveTabindex(page);

    const dismiss = page.getByTestId('alert-dismiss');
    await tabUntilFocused(page, dismiss);
    await activateWithEnter(page);

    await expect(page.getByTestId('alert-banner')).toHaveCount(0);
    await expect(page.getByTestId('alert-banners')).toHaveCount(0);

    await expect
      .poll(async () =>
        page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.alertsDismissed),
      )
      .toBe(JSON.stringify(['alert-kbd-suite']));

    // Spec-named return target — not the document body.
    const returnTarget = page.getByTestId('alert-focus-return');
    await expect(returnTarget).toBeFocused();
  });
});
