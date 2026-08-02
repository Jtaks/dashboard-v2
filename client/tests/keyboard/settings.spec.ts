import { expect, test } from '@playwright/test';

import { installPushStubs, stubKeyboardShell, stubPushApi } from './fixtures.js';
import {
  activateWithEnter,
  activateWithSpace,
  assertKeyboardReachability,
  assertNoPositiveTabindex,
  tabUntilFocused,
} from './helpers.js';

test.describe('keyboard / settings', () => {
  test('subscription controls and feature flags toggle on Enter and Space', async ({ page }) => {
    await stubKeyboardShell(page);
    await installPushStubs(page);
    await stubPushApi(page);

    await page.goto('/settings');
    await expect(page.getByTestId('settings-page')).toBeVisible();
    await expect(page.getByTestId('settings-push')).toHaveAttribute('data-push-ready', 'true');

    await assertNoPositiveTabindex(page);

    // Subscription: Tab to subscribe, Enter activates, state reported.
    const subscribe = page.getByTestId('settings-push-subscribe');
    await tabUntilFocused(page, subscribe);
    await activateWithEnter(page);
    await expect(page.getByTestId('settings-push')).toHaveAttribute(
      'data-push-status',
      'subscribed',
    );

    const unsubscribe = page.getByTestId('settings-push-unsubscribe');
    await tabUntilFocused(page, unsubscribe);
    await activateWithEnter(page);
    await expect(page.getByTestId('settings-push')).toHaveAttribute(
      'data-push-status',
      'not_subscribed',
    );

    // Feature flag: Space toggles on and reports state.
    const toggle = page.getByTestId('settings-flag-toggle-status-summary-popover');
    await tabUntilFocused(page, toggle);
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await activateWithSpace(page);
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('flag-status-summary-popover-state')).toHaveAttribute(
      'data-enabled',
      'true',
    );

    // Enter toggles back off and reports state.
    await activateWithEnter(page);
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('flag-status-summary-popover-state')).toHaveAttribute(
      'data-enabled',
      'false',
    );

    await assertKeyboardReachability(page);
  });
});
