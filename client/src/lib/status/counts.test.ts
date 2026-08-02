import type { ServiceStatus } from '@dashboard/shared';
import { describe, expect, it } from 'vitest';
import { countServicesByStatus, emptyStatusCounts, statusCountEntries } from './counts.js';

describe('countServicesByStatus', () => {
  it('returns zeros for an empty service list', () => {
    expect(countServicesByStatus([])).toEqual(emptyStatusCounts());
  });

  it('counts each status including null services', () => {
    const services: ServiceStatus[] = [
      { id: 'a', status: 'up', since: '2026-01-01T00:00:00.000Z' },
      { id: 'b', status: 'up', since: '2026-01-01T00:00:00.000Z' },
      { id: 'c', status: 'degraded', since: '2026-01-01T00:00:00.000Z' },
      { id: 'd', status: null, since: null },
      { id: 'e', status: 'unknown', since: null },
      { id: 'f', status: 'down', since: '2026-01-01T00:00:00.000Z' },
      { id: 'g', status: 'starting', since: '2026-01-01T00:00:00.000Z' },
      { id: 'h', status: null, since: null },
    ];

    expect(countServicesByStatus(services)).toEqual({
      up: 2,
      starting: 1,
      degraded: 1,
      down: 1,
      unknown: 1,
      null: 2,
    });
  });

  it('does not treat null as unknown', () => {
    const services: ServiceStatus[] = [
      { id: 'link', status: null, since: null },
      { id: 'api', status: 'up', since: '2026-01-01T00:00:00.000Z' },
    ];

    expect(countServicesByStatus(services)).toEqual({
      ...emptyStatusCounts(),
      up: 1,
      null: 1,
    });
  });
});

describe('statusCountEntries', () => {
  it('omits zero buckets and orders worst-first with null last', () => {
    expect(
      statusCountEntries({
        up: 2,
        starting: 0,
        degraded: 1,
        down: 0,
        unknown: 0,
        null: 1,
      }),
    ).toEqual([
      { key: 'degraded', count: 1 },
      { key: 'up', count: 2 },
      { key: 'null', count: 1 },
    ]);
  });
});
