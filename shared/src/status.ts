import type { Status } from './api.js';

/**
 * Worst-first ordering: down > degraded > unknown > starting > up.
 * A real failure outranks an unknown; an unknown outranks anything healthy.
 */
export const STATUS_ORDER = [
  'down',
  'degraded',
  'unknown',
  'starting',
  'up',
] as const satisfies readonly Status[];

const STATUS_RANK: Record<Status, number> = {
  down: 4,
  degraded: 3,
  unknown: 2,
  starting: 1,
  up: 0,
};

/** Returns true when `a` is strictly worse than `b` per STATUS_ORDER. */
export function isWorseStatus(a: Status, b: Status): boolean {
  return STATUS_RANK[a] > STATUS_RANK[b];
}

/**
 * Reduces a list of statuses to the worst one.
 * `null` entries (services with no containers) are excluded, not treated as unknown.
 * An empty list (or only nulls) yields `null`.
 */
export function aggregateStatuses(statuses: readonly (Status | null)[]): Status | null {
  let worst: Status | null = null;
  for (const status of statuses) {
    if (status === null) continue;
    if (worst === null || isWorseStatus(status, worst)) {
      worst = status;
    }
  }
  return worst;
}
