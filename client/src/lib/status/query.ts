import type { StatusReport } from '@dashboard/shared';
import { queryOptions } from '@tanstack/svelte-query';
import { apiFetch, ForbiddenError, UnauthorizedError } from '$lib/api/client.js';

/** Shared cache key so every status consumer shares one poll. */
export const statusQueryKey = ['status'] as const;

/** Seven seconds per TDD Health collection. */
export const STATUS_REFETCH_INTERVAL_MS = 7_000;

export function fetchStatus(): Promise<StatusReport> {
  return apiFetch<StatusReport>('/api/status');
}

function isAuthFailure(error: Error | null): boolean {
  return error instanceof UnauthorizedError || error instanceof ForbiddenError;
}

/**
 * Status is polled every seven seconds while the tab is visible (TDD Health collection).
 * C4/C5 should call `createQuery(() => statusQueryOptions())` rather than fetching on their own.
 *
 * `refetchIntervalInBackground: false` skips interval ticks while hidden.
 * `refetchOnWindowFocus: true` issues one immediate refetch when the tab becomes visible again
 * (layout defaults that to false for other queries).
 * 401/403 stop the interval so we do not retry against a dead session.
 */
export function statusQueryOptions() {
  return queryOptions({
    queryKey: statusQueryKey,
    queryFn: fetchStatus,
    refetchInterval: (query) =>
      isAuthFailure(query.state.error) ? false : STATUS_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: (query) => !isAuthFailure(query.state.error),
    retry: false,
  });
}

/**
 * Separates never-loaded, last-successful, and failed-refresh for presentation tasks.
 * A failed poll keeps `report` from the last success and surfaces `error` separately.
 */
export function readStatusQueryState(result: {
  data: StatusReport | undefined;
  error: Error | null;
  isPending: boolean;
}) {
  return {
    /** Last successful report; null until the first success. Survives a failed refresh. */
    report: result.data ?? null,
    /** True only before any successful (or failed) settlement — never-loaded. */
    isLoading: result.isPending,
    /** Most recent failure, if any. Independent of whether `report` is still readable. */
    error: result.error,
  };
}
