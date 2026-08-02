import { describe, expect, it } from 'vitest';

import { deletePushSubscriptionBodySchema, pushSubscriptionBodySchema } from './validation.js';

const validSubscription = {
  endpoint: 'https://push.example/device-1',
  keys: {
    p256dh: 'BBvAqccKn9JVUDVBF0i4Xwvx0Rm39fzxQIgTZSl6-ItXsv4zaHoYOPKHeSd4mKBeojpKDB2Kgamft7UYb5SSoBs',
    auth: 'auth-secret-value',
  },
};

describe('pushSubscriptionBodySchema', () => {
  it('accepts a valid subscription', () => {
    const result = pushSubscriptionBodySchema.safeParse(validSubscription);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validSubscription);
    }
  });

  it('rejects a body missing keys.auth', () => {
    const result = pushSubscriptionBodySchema.safeParse({
      endpoint: validSubscription.endpoint,
      keys: { p256dh: validSubscription.keys.p256dh },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty endpoint', () => {
    const result = pushSubscriptionBodySchema.safeParse({
      ...validSubscription,
      endpoint: '',
    });
    expect(result.success).toBe(false);
  });

  it('strips extra fields such as expirationTime', () => {
    const result = pushSubscriptionBodySchema.safeParse({
      ...validSubscription,
      expirationTime: null,
      extra: 'ignored',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validSubscription);
      expect(result.data).not.toHaveProperty('expirationTime');
      expect(result.data).not.toHaveProperty('extra');
    }
  });
});

describe('deletePushSubscriptionBodySchema', () => {
  it('accepts an endpoint', () => {
    const result = deletePushSubscriptionBodySchema.safeParse({
      endpoint: 'https://push.example/device-1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty endpoint', () => {
    const result = deletePushSubscriptionBodySchema.safeParse({ endpoint: '' });
    expect(result.success).toBe(false);
  });
});
