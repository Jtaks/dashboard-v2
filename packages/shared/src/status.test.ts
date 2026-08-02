import { describe, expect, it } from 'vitest';

import { STATUS_ORDER, aggregateStatuses, compareStatus } from './status.js';
import type { Status } from './types/api.js';

describe('STATUS_ORDER', () => {
  it('orders statuses from worst to best', () => {
    expect(STATUS_ORDER).toEqual(['down', 'degraded', 'unknown', 'starting', 'up']);
  });

  it('ranks worse statuses before better ones', () => {
    expect(compareStatus('down', 'up')).toBeLessThan(0);
    expect(compareStatus('unknown', 'starting')).toBeLessThan(0);
    expect(compareStatus('up', 'up')).toBe(0);
  });
});

describe('aggregateStatuses', () => {
  it('returns unknown when aggregating up and unknown', () => {
    expect(aggregateStatuses(['up', 'unknown'])).toBe('unknown');
  });

  it('returns down when aggregating down and unknown', () => {
    expect(aggregateStatuses(['down', 'unknown'])).toBe('down');
  });

  it('returns up when all statuses are up', () => {
    expect(aggregateStatuses(['up', 'up'])).toBe('up');
  });

  it('returns null for an empty list', () => {
    expect(aggregateStatuses([])).toBeNull();
  });

  it('excludes null services from aggregation', () => {
    const statuses: (Status | null)[] = ['up', null, 'degraded'];
    expect(aggregateStatuses(statuses)).toBe('degraded');
  });

  it('returns null when every status is null', () => {
    expect(aggregateStatuses([null, null])).toBeNull();
  });
});
