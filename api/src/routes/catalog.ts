import type { Catalog } from '@dashboard/shared';
import type { Context } from 'hono';

import { filterCatalog } from '../catalog.js';
import type { ResolvedConfig } from '../config.js';
import type { AppVariables } from '../types.js';

/** GET /api/catalog — applications and services visible to the caller. */
export function catalogHandler(
  config: ResolvedConfig,
): (c: Context<{ Variables: AppVariables }>) => Response {
  return (c) => {
    const identity = c.get('identity');
    const body: Catalog = filterCatalog(config, identity.groups);
    return c.json(body);
  };
}
