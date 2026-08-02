import type { Catalog } from '@dashboard/shared';
import { queryOptions } from '@tanstack/svelte-query';
import { apiFetch } from '$lib/api/client.js';

/** Shared cache key so list, grid, search, and detail reuse one catalog fetch. */
export const catalogQueryKey = ['catalog'] as const;

export function fetchCatalog(): Promise<Catalog> {
  return apiFetch<Catalog>('/api/catalog');
}

/**
 * Catalog is fetched once per session (TDD API surface).
 * B3/B4/B5 should call `createQuery(() => catalogQueryOptions())` rather than refetching.
 */
export function catalogQueryOptions() {
  return queryOptions({
    queryKey: catalogQueryKey,
    queryFn: fetchCatalog,
    staleTime: Infinity,
    retry: false,
  });
}
