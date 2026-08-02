import type { Application, Catalog } from '@dashboard/shared';

export function findApplicationInCatalog(catalog: Catalog, id: string): Application | undefined {
  return catalog.applications.find((application) => application.id === id);
}
