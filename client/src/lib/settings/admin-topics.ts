import { queryOptions } from '@tanstack/svelte-query';
import { apiFetch } from '$lib/api/client.js';

/** Shared key for the settings admin probe (GET /api/admin/topics). */
export const adminTopicsQueryKey = ['admin', 'topics'] as const;

export function fetchAdminTopics(): Promise<string[]> {
  return apiFetch<string[]>('/api/admin/topics');
}

/**
 * Admin views must not assume they were only rendered for admins (TDD Feature flags).
 * Settings probes an admin endpoint so a 403 can degrade to the A6 refusal state.
 */
export function adminTopicsQueryOptions() {
  return queryOptions({
    queryKey: adminTopicsQueryKey,
    queryFn: fetchAdminTopics,
    retry: false,
  });
}
