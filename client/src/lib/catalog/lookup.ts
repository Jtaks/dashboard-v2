import type { Application, Catalog } from '@dashboard/shared';

/**
 * Resolve an application by stable `id` from a catalog payload.
 * Returns undefined when the id is absent — mistype and unauthorized look the same.
 */
export function findApplicationById(
  catalog: Catalog | null | undefined,
  id: string | null | undefined,
): Application | undefined {
  if (!catalog || id == null || id === '') {
    return undefined;
  }
  return catalog.applications.find((application) => application.id === id);
}
