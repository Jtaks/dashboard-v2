import type { Status } from './types/api.js';

/** Worst-first status ordering: down > degraded > unknown > starting > up */
export const STATUS_ORDER: readonly Status[] = [
  'down',
  'degraded',
  'unknown',
  'starting',
  'up',
] as const;

const STATUS_RANK: Record<Status, number> = {
  down: 0,
  degraded: 1,
  unknown: 2,
  starting: 3,
  up: 4,
};

/** Returns a negative number when `a` is worse than `b`. */
export function compareStatus(a: Status, b: Status): number {
  return STATUS_RANK[a] - STATUS_RANK[b];
}

/** Returns the worse of two statuses. */
export function worstStatus(a: Status, b: Status): Status {
  return compareStatus(a, b) <= 0 ? a : b;
}

/** Reduces a list of statuses to the worst one; null entries are excluded. */
export function aggregateStatuses(statuses: readonly (Status | null)[]): Status | null {
  let result: Status | null = null;

  for (const status of statuses) {
    if (status === null) {
      continue;
    }
    result = result === null ? status : worstStatus(result, status);
  }

  return result;
}
