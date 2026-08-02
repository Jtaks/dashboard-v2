import { describe, expect, it } from 'vitest';

import { isAlertExpired, isAlertTargeted, isVisibleAlert } from './targeting.js';

const REFERENCE_TIME = '2026-06-15T12:00:00.000Z';

describe('alert targeting', () => {
  it('matches when the topic is in the user groups', () => {
    expect(isAlertTargeted('media-users', ['media-users'])).toBe(true);
  });

  it('does not match when the topic is absent from the user groups', () => {
    expect(isAlertTargeted('media-users', ['other-users'])).toBe(false);
  });

  it('matches every group when the topic is *', () => {
    expect(isAlertTargeted('*', [])).toBe(true);
    expect(isAlertTargeted('*', ['media-users'])).toBe(true);
  });

  it('treats a non-null ends_at before the reference time as expired', () => {
    expect(isAlertExpired('2026-06-15T11:59:59.000Z', REFERENCE_TIME)).toBe(true);
  });

  it('treats a non-null ends_at at or after the reference time as active', () => {
    expect(isAlertExpired('2026-06-15T12:00:00.000Z', REFERENCE_TIME)).toBe(false);
    expect(isAlertExpired('2026-06-15T12:00:01.000Z', REFERENCE_TIME)).toBe(false);
  });

  it('never expires when ends_at is null', () => {
    expect(isAlertExpired(null, REFERENCE_TIME)).toBe(false);
  });

  it('combines targeting and expiry for visibility', () => {
    expect(
      isVisibleAlert(
        { topic: 'media-users', endsAt: '2026-06-15T11:59:59.000Z' },
        ['media-users'],
        REFERENCE_TIME,
      ),
    ).toBe(false);

    expect(
      isVisibleAlert(
        { topic: 'media-users', endsAt: '2026-06-15T12:00:01.000Z' },
        ['media-users'],
        REFERENCE_TIME,
      ),
    ).toBe(true);

    expect(
      isVisibleAlert({ topic: 'media-users', endsAt: null }, ['media-users'], REFERENCE_TIME),
    ).toBe(true);

    expect(
      isVisibleAlert(
        { topic: 'media-users', endsAt: null },
        ['other-users'],
        REFERENCE_TIME,
      ),
    ).toBe(false);
  });
});
