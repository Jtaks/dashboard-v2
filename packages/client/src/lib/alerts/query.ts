import { fetchAlerts } from '$lib/api/alerts.js';
import { createQuery } from '@tanstack/svelte-query';

export const alertsQueryKey = ['alerts'] as const;

export function alertsQueryOptions() {
  return {
    queryKey: alertsQueryKey,
    queryFn: fetchAlerts,
  } as const;
}

export function useAlertsQuery(options?: { enabled?: boolean }) {
  return createQuery(() => ({
    ...alertsQueryOptions(),
    enabled: options?.enabled ?? true,
  }));
}
