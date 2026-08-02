import type { ServiceStatus, Status } from '@dashboard/shared';
import { STATUS_ORDER } from '@dashboard/shared';

/** Counts of services in each status bucket, including `null` (no containers). */
export type StatusCounts = Record<Status | 'null', number>;

export function emptyStatusCounts(): StatusCounts {
  return {
    down: 0,
    degraded: 0,
    unknown: 0,
    starting: 0,
    up: 0,
    null: 0,
  };
}

/**
 * Reduces an application's services to counts by status.
 * `null` status (no containers) is counted under `null`, not under `unknown`.
 */
export function countServicesByStatus(services: readonly ServiceStatus[]): StatusCounts {
  const counts = emptyStatusCounts();
  for (const service of services) {
    if (service.status === null) {
      counts.null += 1;
    } else {
      counts[service.status] += 1;
    }
  }
  return counts;
}

/** Non-zero count entries in worst-first order, then null last. */
export function statusCountEntries(
  counts: StatusCounts,
): Array<{ key: Status | 'null'; count: number }> {
  const entries: Array<{ key: Status | 'null'; count: number }> = [];
  for (const status of STATUS_ORDER) {
    const count = counts[status];
    if (count > 0) {
      entries.push({ key: status, count });
    }
  }
  if (counts.null > 0) {
    entries.push({ key: 'null', count: counts.null });
  }
  return entries;
}
