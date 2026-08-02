import { describe, expect, it } from 'vitest';

import { resolvePushSubscriptionStatus } from './settings-state.js';

const baseInput = {
  pushSupported: true,
  hasSubscription: false,
  notificationPermission: 'default' as const,
};

describe('resolvePushSubscriptionStatus', () => {
  it('returns subscribed when a subscription is present', () => {
    expect(
      resolvePushSubscriptionStatus({
        ...baseInput,
        hasSubscription: true,
      }),
    ).toBe('subscribed');
  });

  it('returns not_subscribed when there is no subscription and permission is not denied', () => {
    expect(resolvePushSubscriptionStatus(baseInput)).toBe('not_subscribed');
    expect(
      resolvePushSubscriptionStatus({
        ...baseInput,
        notificationPermission: 'granted',
      }),
    ).toBe('not_subscribed');
  });

  it('returns blocked when permission is denied and there is no subscription', () => {
    expect(
      resolvePushSubscriptionStatus({
        ...baseInput,
        notificationPermission: 'denied',
      }),
    ).toBe('blocked');
  });

  it('returns subscribed when a subscription exists even if permission is denied', () => {
    expect(
      resolvePushSubscriptionStatus({
        ...baseInput,
        hasSubscription: true,
        notificationPermission: 'denied',
      }),
    ).toBe('subscribed');
  });

  it('returns null when push is unsupported', () => {
    expect(
      resolvePushSubscriptionStatus({
        ...baseInput,
        pushSupported: false,
      }),
    ).toBeNull();
  });
});
