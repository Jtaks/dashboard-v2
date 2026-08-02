import type { ServiceStatus } from '@dashboard/shared';
import { describe, expect, it } from 'vitest';

import { countServicesByStatus } from './counts.js';

describe('countServicesByStatus', () => {
  it('returns zero counts for an empty list', () => {
    expect(countServicesByStatus([])).toEqual({
      up: 0,
      starting: 0,
      degraded: 0,
      down: 0,
      unknown: 0,
    });
  });

  it('ignores services with a null status', () => {
    const services: ServiceStatus[] = [
      { id: 'a', status: null, since: null },
      { id: 'b', status: 'up', since: '2026-01-01T10:00:00.000Z' },
      { id: 'c', status: null, since: null },
      { id: 'd', status: 'down', since: '2026-01-01T11:00:00.000Z' },
    ];

    expect(countServicesByStatus(services)).toEqual({
      up: 1,
      starting: 0,
      degraded: 0,
      down: 1,
      unknown: 0,
    });
  });

  it('counts every non-null status value', () => {
    const services: ServiceStatus[] = [
      { id: 'a', status: 'up', since: '2026-01-01T10:00:00.000Z' },
      { id: 'b', status: 'starting', since: '2026-01-01T10:00:00.000Z' },
      { id: 'c', status: 'degraded', since: '2026-01-01T10:00:00.000Z' },
      { id: 'd', status: 'down', since: '2026-01-01T10:00:00.000Z' },
      { id: 'e', status: 'unknown', since: null },
      { id: 'f', status: 'up', since: '2026-01-01T10:00:00.000Z' },
    ];

    expect(countServicesByStatus(services)).toEqual({
      up: 2,
      starting: 1,
      degraded: 1,
      down: 1,
      unknown: 1,
    });
  });
});
