import { fetchStatus } from '$lib/api/status.js';
import { ApiError } from '$lib/api/client.js';
import { keepPreviousData } from '@tanstack/svelte-query';
import { createQuery } from '@tanstack/svelte-query';

export const STATUS_REFETCH_INTERVAL_MS = 7_000;

export const statusQueryKey = ['status'] as const;

export function isDocumentVisible(): boolean {
  if (typeof document === 'undefined') {
    return true;
  }

  return document.visibilityState !== 'hidden';
}

export function resolveStatusRefetchInterval(): number | false {
  return isDocumentVisible() ? STATUS_REFETCH_INTERVAL_MS : false;
}

function shouldRetryStatusQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.isUnauthorized || error.isForbidden)) {
    return false;
  }

  return failureCount < 1;
}

export function statusQueryOptions() {
  return {
    queryKey: statusQueryKey,
    queryFn: fetchStatus,
    refetchInterval: resolveStatusRefetchInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always' as const,
    placeholderData: keepPreviousData,
    retry: shouldRetryStatusQuery,
  } as const;
}

export function useStatusQuery(options?: { enabled?: boolean }) {
  return createQuery(() => ({
    ...statusQueryOptions(),
    enabled: options?.enabled ?? true,
  }));
}
