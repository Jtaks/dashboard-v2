import { describe, expect, it } from 'vitest';

import { STATUS_ORDER, aggregateStatuses, isWorseStatus } from './status.js';

describe('STATUS_ORDER', () => {
  it('orders down > degraded > unknown > starting > up', () => {
    expect(STATUS_ORDER).toEqual(['down', 'degraded', 'unknown', 'starting', 'up']);
  });
});

describe('isWorseStatus', () => {
  it('ranks failures above unknown and unknown above healthy', () => {
    expect(isWorseStatus('down', 'unknown')).toBe(true);
    expect(isWorseStatus('unknown', 'up')).toBe(true);
    expect(isWorseStatus('up', 'starting')).toBe(false);
    expect(isWorseStatus('degraded', 'degraded')).toBe(false);
  });
});

describe('aggregateStatuses', () => {
  it("aggregates ['up', 'unknown'] to unknown", () => {
    expect(aggregateStatuses(['up', 'unknown'])).toBe('unknown');
  });

  it("aggregates ['down', 'unknown'] to down", () => {
    expect(aggregateStatuses(['down', 'unknown'])).toBe('down');
  });

  it("aggregates ['up', 'up'] to up", () => {
    expect(aggregateStatuses(['up', 'up'])).toBe('up');
  });

  it('returns null for an empty list', () => {
    expect(aggregateStatuses([])).toBeNull();
  });

  it('excludes null services rather than treating them as unknown', () => {
    expect(aggregateStatuses(['up', null])).toBe('up');
    expect(aggregateStatuses([null, null])).toBeNull();
    expect(aggregateStatuses([null, 'unknown', 'up'])).toBe('unknown');
  });
});
