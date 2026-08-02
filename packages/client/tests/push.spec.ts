import { STORAGE_KEY_PUSH_PROMPT } from '@dashboard/shared';
import { expect, test } from '@playwright/test';

import {
  defaultSession,
  stubAlerts,
  stubCatalog,
  stubSession,
  stubStatus,
} from './helpers/stubs.js';
import { stubPushApi, stubPushEnvironment } from './helpers/push.js';

const emptyCatalog = { applications: [] };

const existingSubscription = {
  endpoint: 'https://push.example/subscription/1',
  keys: {
    p256dh: 'existing-p256dh',
    auth: 'existing-auth',
  },
};

async function tabTo(
  page: import('@playwright/test').Page,
  locator: import('@playwright/test').Locator,
) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) {
      return;
    }

    await page.keyboard.press('Tab');
  }

  throw new Error('Could not reach the target element by keyboard');
}

async function stubAuthenticatedShell(page: import('@playwright/test').Page) {
  await stubSession(page, defaultSession);
  await stubCatalog(page, emptyCatalog);
  await stubStatus(page);
  await stubAlerts(page);
}

test.describe('push permission prompt', () => {
  test('upserts an existing subscription on load and shows no prompt', async ({ page }) => {
    await stubPushEnvironment(page, {
      permission: 'granted',
      subscription: existingSubscription,
    });
    await stubAuthenticatedShell(page);
    const pushApi = await stubPushApi(page);

    await page.goto('/');

    await expect(page.getByTestId('push-permission-prompt')).toHaveCount(0);
    await expect.poll(() => pushApi.getUpsertCount()).toBe(1);
    expect(pushApi.getLastUpsertBody()).toEqual(existingSubscription);
  });

  test('shows the prompt without a subscription and accepts it by keyboard alone', async ({
    page,
  }) => {
    await stubPushEnvironment(page, {
      permission: 'default',
      subscription: null,
    });
    await stubAuthenticatedShell(page);
    const pushApi = await stubPushApi(page);

    await page.goto('/');

    const prompt = page.getByTestId('push-permission-prompt');
    await expect(prompt).toBeVisible();
    expect(pushApi.getUpsertCount()).toBe(0);

    const acceptButton = page.getByTestId('push-prompt-accept');
    await tabTo(page, acceptButton);
    await page.keyboard.press('Enter');

    await expect(prompt).toHaveCount(0);
    await expect.poll(() => pushApi.getUpsertCount()).toBe(1);
    expect(pushApi.getLastUpsertBody()).toEqual({
      endpoint: 'https://push.example/subscription/new',
      keys: {
        p256dh: 'new-p256dh',
        auth: 'new-auth',
      },
    });
  });

  test('stores a dismissal and does not show the prompt again after reload', async ({ page }) => {
    await stubPushEnvironment(page, {
      permission: 'default',
      subscription: null,
    });
    await stubAuthenticatedShell(page);
    await stubPushApi(page);

    await page.goto('/');

    const declineButton = page.getByTestId('push-prompt-decline');
    await expect(declineButton).toBeVisible();
    await declineButton.click();

    await expect(page.getByTestId('push-permission-prompt')).toHaveCount(0);

    const storedPrompt = await page.evaluate((storageKey) => localStorage.getItem(storageKey), STORAGE_KEY_PUSH_PROMPT);
    expect(storedPrompt).toBe('dismissed');

    await page.reload();

    await expect(page.getByTestId('push-permission-prompt')).toHaveCount(0);
  });
});
