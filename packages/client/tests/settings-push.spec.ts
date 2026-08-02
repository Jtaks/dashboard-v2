import { STORAGE_KEY_PUSH_PROMPT } from '@dashboard/shared';
import { expect, test } from '@playwright/test';

import {
  stubIosSafari,
  stubPushApi,
  stubPushEnvironment,
} from './helpers/push.js';
import { defaultSession, stubSession, stubStatus } from './helpers/stubs.js';

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

async function stubSettingsShell(page: import('@playwright/test').Page) {
  await stubSession(page, defaultSession);
  await stubStatus(page);
}

test.describe('settings push subscription section', () => {
  test('shows subscribed state with an unsubscribe action', async ({ page }) => {
    await stubPushEnvironment(page, {
      permission: 'granted',
      subscription: existingSubscription,
    });
    await stubSettingsShell(page);
    await stubPushApi(page);

    await page.goto('/settings');

    await expect(page.getByTestId('settings-push-section')).toBeVisible();
    await expect(page.getByTestId('settings-push-status')).toHaveText(
      'This device receives push notifications.',
    );
    await expect(page.getByTestId('settings-push-subscribe')).toHaveCount(0);
    await expect(page.getByTestId('settings-push-unsubscribe')).toBeVisible();
  });

  test('shows not subscribed state with a subscribe action', async ({ page }) => {
    await stubPushEnvironment(page, {
      permission: 'default',
      subscription: null,
    });
    await stubSettingsShell(page);
    await stubPushApi(page);

    await page.goto('/settings');

    await expect(page.getByTestId('settings-push-status')).toHaveText(
      'This device is not subscribed to push notifications.',
    );
    await expect(page.getByTestId('settings-push-subscribe')).toBeVisible();
    await expect(page.getByTestId('settings-push-unsubscribe')).toHaveCount(0);
  });

  test('shows blocked state without actions when permission is denied', async ({ page }) => {
    await stubPushEnvironment(page, {
      permission: 'denied',
      subscription: null,
    });
    await stubSettingsShell(page);
    await stubPushApi(page);

    await page.goto('/settings');

    await expect(page.getByTestId('settings-push-status')).toHaveText(
      'Notifications are blocked in your browser. Change this in your browser settings to enable push notifications.',
    );
    await expect(page.getByTestId('settings-push-subscribe')).toHaveCount(0);
    await expect(page.getByTestId('settings-push-unsubscribe')).toHaveCount(0);
  });

  test('subscribes from settings and clears a dismissed prompt', async ({ page }) => {
    await stubPushEnvironment(page, {
      permission: 'default',
      subscription: null,
    });
    await stubSettingsShell(page);
    const pushApi = await stubPushApi(page);

    await page.addInitScript((storageKey) => {
      localStorage.setItem(storageKey, 'dismissed');
    }, STORAGE_KEY_PUSH_PROMPT);

    await page.goto('/settings');

    await page.getByTestId('settings-push-subscribe').click();

    await expect.poll(() => pushApi.getUpsertCount()).toBe(1);
    expect(pushApi.getLastUpsertBody()).toEqual({
      endpoint: 'https://push.example/subscription/new',
      keys: {
        p256dh: 'new-p256dh',
        auth: 'new-auth',
      },
    });
    await expect(page.getByTestId('settings-push-status')).toHaveText(
      'This device receives push notifications.',
    );

    const storedPrompt = await page.evaluate(
      (storageKey) => localStorage.getItem(storageKey),
      STORAGE_KEY_PUSH_PROMPT,
    );
    expect(storedPrompt).toBeNull();
  });

  test('unsubscribes from settings and deletes the server row', async ({ page }) => {
    await stubPushEnvironment(page, {
      permission: 'granted',
      subscription: existingSubscription,
    });
    await stubSettingsShell(page);
    const pushApi = await stubPushApi(page);

    await page.goto('/settings');

    await page.getByTestId('settings-push-unsubscribe').click();

    await expect.poll(() => pushApi.getDeleteCount()).toBe(1);
    expect(pushApi.getLastDeleteBody()).toEqual({
      endpoint: existingSubscription.endpoint,
    });
    await expect(page.getByTestId('settings-push-status')).toHaveText(
      'This device is not subscribed to push notifications.',
    );
  });

  test('shows the iOS notice outside an installed PWA', async ({ page }) => {
    await stubPushEnvironment(page, {
      permission: 'default',
      subscription: null,
    });
    await stubIosSafari(page, { installedPwa: false });
    await stubSettingsShell(page);
    await stubPushApi(page);

    await page.goto('/settings');

    await expect(page.getByTestId('settings-push-ios-notice')).toHaveText(
      'On iPhone and iPad, push notifications require adding this dashboard to your home screen.',
    );
  });

  test('hides the iOS notice when installed as a PWA', async ({ page }) => {
    await stubPushEnvironment(page, {
      permission: 'default',
      subscription: null,
    });
    await stubIosSafari(page, { installedPwa: true });
    await stubSettingsShell(page);
    await stubPushApi(page);

    await page.goto('/settings');

    await expect(page.getByTestId('settings-push-ios-notice')).toHaveCount(0);
  });

  test('hides the iOS notice outside iOS Safari', async ({ page }) => {
    await stubPushEnvironment(page, {
      permission: 'default',
      subscription: null,
    });
    await stubSettingsShell(page);
    await stubPushApi(page);

    await page.goto('/settings');

    await expect(page.getByTestId('settings-push-ios-notice')).toHaveCount(0);
  });

  test('subscribes by keyboard alone', async ({ page }) => {
    await stubPushEnvironment(page, {
      permission: 'default',
      subscription: null,
    });
    await stubSettingsShell(page);
    const pushApi = await stubPushApi(page);

    await page.goto('/settings');

    const subscribeButton = page.getByTestId('settings-push-subscribe');
    await tabTo(page, subscribeButton);
    await page.keyboard.press('Enter');

    await expect.poll(() => pushApi.getUpsertCount()).toBe(1);
    await expect(page.getByTestId('settings-push-status')).toHaveText(
      'This device receives push notifications.',
    );
  });

  test('unsubscribes by keyboard alone', async ({ page }) => {
    await stubPushEnvironment(page, {
      permission: 'granted',
      subscription: existingSubscription,
    });
    await stubSettingsShell(page);
    const pushApi = await stubPushApi(page);

    await page.goto('/settings');

    const unsubscribeButton = page.getByTestId('settings-push-unsubscribe');
    await tabTo(page, unsubscribeButton);
    await page.keyboard.press('Enter');

    await expect.poll(() => pushApi.getDeleteCount()).toBe(1);
    await expect(page.getByTestId('settings-push-status')).toHaveText(
      'This device is not subscribed to push notifications.',
    );
  });
});
