import { describe, expect, it } from 'vitest';
import {
  deriveSettingsPushStatus,
  deriveSettingsPushView,
  isInstalledPwa,
  isIosSafari,
  shouldShowIosPwaNotice,
  type SettingsPushStatusInput,
} from './settings-status.js';

function statusInput(overrides: Partial<SettingsPushStatusInput> = {}): SettingsPushStatusInput {
  return {
    hasSubscription: false,
    permission: 'default',
    ...overrides,
  };
}

describe('deriveSettingsPushStatus', () => {
  it('returns subscribed when a subscription is present and permission is not denied', () => {
    expect(
      deriveSettingsPushStatus(statusInput({ hasSubscription: true, permission: 'granted' })),
    ).toBe('subscribed');
    expect(
      deriveSettingsPushStatus(statusInput({ hasSubscription: true, permission: 'default' })),
    ).toBe('subscribed');
    expect(
      deriveSettingsPushStatus(statusInput({ hasSubscription: true, permission: 'unsupported' })),
    ).toBe('subscribed');
  });

  it('returns not_subscribed when there is no subscription and permission is not denied', () => {
    expect(deriveSettingsPushStatus(statusInput({ permission: 'default' }))).toBe('not_subscribed');
    expect(deriveSettingsPushStatus(statusInput({ permission: 'granted' }))).toBe('not_subscribed');
    expect(deriveSettingsPushStatus(statusInput({ permission: 'unsupported' }))).toBe(
      'not_subscribed',
    );
  });

  it('returns blocked when permission is denied regardless of subscription', () => {
    expect(deriveSettingsPushStatus(statusInput({ permission: 'denied' }))).toBe('blocked');
    expect(
      deriveSettingsPushStatus(statusInput({ hasSubscription: true, permission: 'denied' })),
    ).toBe('blocked');
  });

  it('covers the subscription × permission matrix', () => {
    const permissions = ['default', 'granted', 'denied', 'unsupported'] as const;
    const expected: Record<string, string> = {};

    for (const hasSubscription of [false, true]) {
      for (const permission of permissions) {
        expected[`${hasSubscription}:${permission}`] = deriveSettingsPushStatus({
          hasSubscription,
          permission,
        });
      }
    }

    expect(expected).toEqual({
      'false:default': 'not_subscribed',
      'false:granted': 'not_subscribed',
      'false:denied': 'blocked',
      'false:unsupported': 'not_subscribed',
      'true:default': 'subscribed',
      'true:granted': 'subscribed',
      'true:denied': 'blocked',
      'true:unsupported': 'subscribed',
    });
  });
});

describe('deriveSettingsPushView', () => {
  it('offers unsubscribe only when subscribed and supported', () => {
    expect(
      deriveSettingsPushView({
        supported: true,
        hasSubscription: true,
        permission: 'granted',
      }),
    ).toEqual({
      status: 'subscribed',
      showSubscribe: false,
      showUnsubscribe: true,
    });
  });

  it('offers subscribe only when not subscribed, supported, and not blocked', () => {
    expect(
      deriveSettingsPushView({
        supported: true,
        hasSubscription: false,
        permission: 'default',
      }),
    ).toEqual({
      status: 'not_subscribed',
      showSubscribe: true,
      showUnsubscribe: false,
    });
  });

  it('offers neither action when blocked', () => {
    expect(
      deriveSettingsPushView({
        supported: true,
        hasSubscription: false,
        permission: 'denied',
      }),
    ).toEqual({
      status: 'blocked',
      showSubscribe: false,
      showUnsubscribe: false,
    });
  });

  it('offers neither action when push is unsupported', () => {
    expect(
      deriveSettingsPushView({
        supported: false,
        hasSubscription: false,
        permission: 'unsupported',
      }),
    ).toEqual({
      status: 'not_subscribed',
      showSubscribe: false,
      showUnsubscribe: false,
    });
  });
});

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const DESKTOP_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('isIosSafari', () => {
  it('detects iPhone Safari', () => {
    expect(isIosSafari(IPHONE_SAFARI)).toBe(true);
  });

  it('rejects Chrome on iOS', () => {
    expect(isIosSafari(IPHONE_CHROME)).toBe(false);
  });

  it('detects iPadOS Safari via Macintosh UA + touch points', () => {
    expect(isIosSafari(IPAD_DESKTOP_UA, 5)).toBe(true);
    expect(isIosSafari(IPAD_DESKTOP_UA, 0)).toBe(false);
  });

  it('rejects desktop browsers', () => {
    expect(isIosSafari(DESKTOP_CHROME)).toBe(false);
  });
});

describe('isInstalledPwa', () => {
  it('is true when either standalone signal is set', () => {
    expect(isInstalledPwa({ navigatorStandalone: true })).toBe(true);
    expect(isInstalledPwa({ displayModeStandalone: true })).toBe(true);
    expect(isInstalledPwa({})).toBe(false);
  });
});

describe('shouldShowIosPwaNotice', () => {
  it('shows on iOS Safari outside an installed PWA', () => {
    expect(
      shouldShowIosPwaNotice({
        userAgent: IPHONE_SAFARI,
        navigatorStandalone: false,
        displayModeStandalone: false,
      }),
    ).toBe(true);
  });

  it('suppresses the notice when installed as a PWA (navigator.standalone)', () => {
    expect(
      shouldShowIosPwaNotice({
        userAgent: IPHONE_SAFARI,
        navigatorStandalone: true,
        displayModeStandalone: false,
      }),
    ).toBe(false);
  });

  it('suppresses the notice when display-mode is standalone', () => {
    expect(
      shouldShowIosPwaNotice({
        userAgent: IPHONE_SAFARI,
        navigatorStandalone: false,
        displayModeStandalone: true,
      }),
    ).toBe(false);
  });

  it('is absent on non-iOS Safari browsers', () => {
    expect(
      shouldShowIosPwaNotice({
        userAgent: DESKTOP_CHROME,
        navigatorStandalone: false,
        displayModeStandalone: false,
      }),
    ).toBe(false);
    expect(
      shouldShowIosPwaNotice({
        userAgent: IPHONE_CHROME,
        navigatorStandalone: false,
        displayModeStandalone: false,
      }),
    ).toBe(false);
  });
});
