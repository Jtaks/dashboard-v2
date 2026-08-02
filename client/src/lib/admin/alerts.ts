import type { Alert } from '@dashboard/shared';
import { queryOptions } from '@tanstack/svelte-query';
import { apiFetch } from '$lib/api/client.js';
import type { CreateAlertBody, PatchAlertBody } from './form.js';

/** Shared key for GET /api/admin/alerts (includes expired). */
export const adminAlertsQueryKey = ['admin', 'alerts'] as const;

export function fetchAdminAlerts(): Promise<Alert[]> {
  return apiFetch<Alert[]>('/api/admin/alerts');
}

export function adminAlertsQueryOptions() {
  return queryOptions({
    queryKey: adminAlertsQueryKey,
    queryFn: fetchAdminAlerts,
    retry: false,
  });
}

export function createAdminAlert(body: CreateAlertBody): Promise<Alert> {
  return apiFetch<Alert>('/api/admin/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchAdminAlert(id: string, body: PatchAlertBody): Promise<Alert> {
  return apiFetch<Alert>(`/api/admin/alerts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteAdminAlert(id: string): Promise<void> {
  return apiFetch<void>(`/api/admin/alerts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
