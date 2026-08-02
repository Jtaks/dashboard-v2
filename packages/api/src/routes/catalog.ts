import type { Catalog } from '@dashboard/shared';
import { Hono } from 'hono';

import type { AppBindings } from '../app.js';
import { buildCatalog } from '../catalog/build-catalog.js';
import { getConfig } from '../config/get-config.js';
import type { Identity } from '../middleware/identity.js';

export function createCatalogRoute() {
  const route = new Hono<AppBindings>();

  route.get('/catalog', (c) => {
    const identity = c.get('identity') as Identity;
    const catalog: Catalog = buildCatalog(getConfig(), identity.groups);

    return c.json(catalog);
  });

  return route;
}
