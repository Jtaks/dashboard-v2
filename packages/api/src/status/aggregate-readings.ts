import { aggregateStatuses, type Status } from '@dashboard/shared';

import type { ContainerReading } from './types.js';

export function aggregateReadings(readings: readonly ContainerReading[]): {
  status: Status | null;
  since: string | null;
} {
  const status = aggregateStatuses(readings.map((reading) => reading.status));

  if (status === null) {
    return { status: null, since: null };
  }

  const tied = readings.filter((reading) => reading.status === status);
  const sinceValues = tied
    .map((reading) => reading.since)
    .filter((since): since is string => since !== null);

  if (sinceValues.length === 0) {
    return { status, since: null };
  }

  sinceValues.sort();
  return { status, since: sinceValues[0] ?? null };
}
