import { describe, expect, it } from 'vitest';

import { filterAlertsForUser, isAlertVisible } from './filter.js';
import type { AlertRecord } from './repository.js';

const now = new Date('2024-06-15T12:00:00.000Z');

function record(overrides: Partial<AlertRecord> = {}): AlertRecord {
  return {
    id: 'a1',
    severity: 'info',
    title: 'Title',
    body: null,
    topic: 'media-users',
    endsAt: null,
    createdAt: '2024-06-01T00:00:00.000Z',
    createdBy: 'alice',
    ...overrides,
  };
}

describe('isAlertVisible', () => {
  it('returns true when the topic matches a user group', () => {
    expect(isAlertVisible(record({ topic: 'media-users' }), ['media-users'], now)).toBe(true);
  });

  it('returns false when the topic is not in the user groups', () => {
    expect(isAlertVisible(record({ topic: 'media-users' }), ['docs-users'], now)).toBe(false);
  });

  it('returns true for topic * for any authenticated groups', () => {
    expect(isAlertVisible(record({ topic: '*' }), ['docs-users'], now)).toBe(true);
    expect(isAlertVisible(record({ topic: '*' }), ['system-admins'], now)).toBe(true);
  });

  it('excludes an endsAt a moment before the reference time', () => {
    expect(
      isAlertVisible(record({ endsAt: '2024-06-15T11:59:59.999Z' }), ['media-users'], now),
    ).toBe(false);
  });

  it('includes an endsAt a moment after the reference time', () => {
    expect(
      isAlertVisible(record({ endsAt: '2024-06-15T12:00:00.001Z' }), ['media-users'], now),
    ).toBe(true);
  });

  it('includes a null endsAt (never expires)', () => {
    expect(isAlertVisible(record({ endsAt: null }), ['media-users'], now)).toBe(true);
  });

  it('does not grant visibility from adminGroup alone', () => {
    expect(isAlertVisible(record({ topic: 'media-users' }), ['system-admins'], now)).toBe(false);
  });
});

describe('filterAlertsForUser', () => {
  it('preserves input order and drops non-matching rows', () => {
    const alerts = [
      record({ id: '1', topic: '*', createdAt: '2024-06-03T00:00:00.000Z' }),
      record({ id: '2', topic: 'media-users', createdAt: '2024-06-02T00:00:00.000Z' }),
      record({ id: '3', topic: 'docs-users', createdAt: '2024-06-01T00:00:00.000Z' }),
      record({
        id: '4',
        topic: '*',
        endsAt: '2020-01-01T00:00:00.000Z',
        createdAt: '2019-01-01T00:00:00.000Z',
      }),
    ];

    expect(filterAlertsForUser(alerts, ['media-users'], now).map((a) => a.id)).toEqual(['1', '2']);
  });
});
