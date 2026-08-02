import type { ServiceStatus, Status } from '@dashboard/shared';

export type StatusCounts = Record<Status, number>;

const EMPTY_COUNTS: StatusCounts = {
  up: 0,
  starting: 0,
  degraded: 0,
  down: 0,
  unknown: 0,
};

export function countServicesByStatus(services: ServiceStatus[]): StatusCounts {
  const counts: StatusCounts = { ...EMPTY_COUNTS };

  for (const service of services) {
    if (service.status !== null) {
      counts[service.status] += 1;
    }
  }

  return counts;
}
