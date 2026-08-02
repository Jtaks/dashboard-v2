import { expect, test } from '@playwright/test';

import { stubKeyboardShell } from './fixtures.js';
import {
  activateWithEnter,
  activateWithSpace,
  assertNoPositiveTabindex,
  tabUntilFocused,
} from './helpers.js';

test.describe('keyboard / dependency expander', () => {
  test('Enter and Space toggle; expanded state is in the accessibility tree', async ({ page }) => {
    await stubKeyboardShell(page);

    await page.goto('/');
    const mediaRow = page.locator('[data-testid="application-row"][data-app-id="media"]');
    await expect(mediaRow).toBeVisible();

    const expander = mediaRow.getByTestId('status-summary-expander');
    await expect(expander).toBeVisible();
    await expect(expander).toHaveAttribute('aria-expanded', 'false');
    await expect(mediaRow.getByTestId('status-summary-panel')).toHaveCount(0);

    await assertNoPositiveTabindex(page);

    await tabUntilFocused(page, expander);
    await activateWithEnter(page);
    await expect(expander).toHaveAttribute('aria-expanded', 'true');
    await expect(mediaRow.getByTestId('status-summary-panel')).toBeVisible();

    // Expanded state readable from the accessibility tree (role query uses the a11y tree).
    await expect(page.getByRole('button', { expanded: true })).toBeVisible();

    await activateWithSpace(page);
    await expect(expander).toHaveAttribute('aria-expanded', 'false');
    await expect(mediaRow.getByTestId('status-summary-panel')).toHaveCount(0);
    await expect(page.getByRole('button', { expanded: true })).toHaveCount(0);

    // Re-open with Space to prove both keys toggle both directions.
    await activateWithSpace(page);
    await expect(expander).toHaveAttribute('aria-expanded', 'true');
    await activateWithEnter(page);
    await expect(expander).toHaveAttribute('aria-expanded', 'false');
  });
});
