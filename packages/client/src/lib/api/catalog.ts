import type { Catalog } from '@dashboard/shared';

import { apiJson } from './client.js';

export function fetchCatalog(): Promise<Catalog> {
  return apiJson<Catalog>('/api/catalog');
}
