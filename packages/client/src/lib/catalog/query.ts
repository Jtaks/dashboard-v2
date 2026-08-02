import { fetchCatalog } from '$lib/api/catalog.js';
import { createQuery } from '@tanstack/svelte-query';

export const catalogQueryKey = ['catalog'] as const;

export function catalogQueryOptions() {
  return {
    queryKey: catalogQueryKey,
    queryFn: fetchCatalog,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: false,
  } as const;
}

export function useCatalogQuery() {
  return createQuery(() => catalogQueryOptions());
}
