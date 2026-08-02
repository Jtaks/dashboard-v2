import { describe, expect, it } from 'vitest';

import { resolvePushLoadAction } from './decision.js';

const baseInput = {
  pushSupported: true,
  hasSubscription: false,
  notificationPermission: 'default' as const,
  promptDismissed: false,
};

describe('resolvePushLoadAction', () => {
  it('upserts when a subscription is present', () => {
    expect(
      resolvePushLoadAction({
        ...baseInput,
        hasSubscription: true,
      }),
    ).toBe('upsert');
  });

  it('shows the prompt when there is no subscription, permission is default, and the prompt was not dismissed', () => {
    expect(resolvePushLoadAction(baseInput)).toBe('prompt');
  });

  it('does nothing when push is unsupported', () => {
    expect(
      resolvePushLoadAction({
        ...baseInput,
        pushSupported: false,
      }),
    ).toBe('none');
  });

  it('does nothing when permission is denied', () => {
    expect(
      resolvePushLoadAction({
        ...baseInput,
        notificationPermission: 'denied',
      }),
    ).toBe('none');
  });

  it('does nothing when permission is granted without a subscription', () => {
    expect(
      resolvePushLoadAction({
        ...baseInput,
        notificationPermission: 'granted',
      }),
    ).toBe('none');
  });

  it('does nothing when the prompt was dismissed', () => {
    expect(
      resolvePushLoadAction({
        ...baseInput,
        promptDismissed: true,
      }),
    ).toBe('none');
  });

  it('still upserts when a subscription exists even if the prompt was dismissed', () => {
    expect(
      resolvePushLoadAction({
        ...baseInput,
        hasSubscription: true,
        promptDismissed: true,
      }),
    ).toBe('upsert');
  });

  it('still upserts when a subscription exists even when permission is default', () => {
    expect(
      resolvePushLoadAction({
        ...baseInput,
        hasSubscription: true,
        notificationPermission: 'default',
      }),
    ).toBe('upsert');
  });
});
