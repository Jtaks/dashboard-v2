import { expect, test } from '@playwright/test';

import { stubKeyboardShell } from './fixtures.js';
import {
  activateWithEnter,
  assertKeyboardReachability,
  assertNoPositiveTabindex,
  tabUntilFocused,
} from './helpers.js';

test.describe('keyboard / detail', () => {
  test('reaches service list and returns to list by keyboard; focus is not on body', async ({
    page,
  }) => {
    await stubKeyboardShell(page);

    await page.goto('/applications/media');
    await expect(page.getByTestId('application-detail')).toBeVisible();

    await assertNoPositiveTabindex(page);

    const serviceList = page.getByTestId('service-status-list');
    await expect(serviceList).toBeVisible();

    const jellyfin = page.locator('[data-testid="service-status-row"][data-service-id="jellyfin"]');
    const postgres = page.locator('[data-testid="service-status-row"][data-service-id="postgres"]');
    const docs = page.locator('[data-testid="service-status-row"][data-service-id="docs"]');

    await tabUntilFocused(page, jellyfin);
    await expect(jellyfin).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(postgres).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(docs).toBeFocused();

    // Focus must land on a defined element, never the document body.
    const tag = await page.evaluate(() => document.activeElement?.tagName ?? 'NONE');
    expect(tag).not.toBe('BODY');
    expect(tag).not.toBe('HTML');

    await assertKeyboardReachability(page);

    // Return to the list route via the Applications nav link (keyboard only).
    const appsNav = page.getByRole('link', { name: 'Applications' });
    await tabUntilFocused(page, appsNav);
    await activateWithEnter(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('catalog-list')).toBeVisible();

    // Focus lands on the named route target, not the document body.
    await expect(page.getByTestId('route-focus-target')).toBeFocused();
    const afterNav = await page.evaluate(() => document.activeElement === document.body);
    expect(afterNav).toBe(false);
  });
});
