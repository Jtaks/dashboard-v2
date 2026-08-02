import type { Alert } from '@dashboard/shared';
import { queryOptions } from '@tanstack/svelte-query';
import { apiFetch } from '$lib/api/client.js';

/** Shared cache key for GET /api/alerts (targeted, live only). */
export const alertsQueryKey = ['alerts'] as const;

export function fetchAlerts(): Promise<Alert[]> {
  return apiFetch<Alert[]>('/api/alerts');
}

/**
 * User-facing alerts for the banner.
 * AppShell enables this only while a session exists (same pattern as status).
 */
export function alertsQueryOptions() {
  return queryOptions({
    queryKey: alertsQueryKey,
    queryFn: fetchAlerts,
    retry: false,
  });
}
