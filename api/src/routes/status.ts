import type { StatusReport } from '@dashboard/shared';
import type { Context } from 'hono';

import type { ResolvedConfig } from '../config.js';
import type { StatusCache } from '../status/cache.js';
import { filterStatusReport } from '../status/filter.js';
import type { AppVariables } from '../types.js';

/** GET /api/status — entitled slice of the cached health collection. */
export function statusHandler(
  config: ResolvedConfig,
  cache: StatusCache,
): (c: Context<{ Variables: AppVariables }>) => Promise<Response> {
  return async (c) => {
    const identity = c.get('identity');
    const report = await cache.get();
    const body: StatusReport = filterStatusReport(report, config, identity.groups);
    return c.json(body);
  };
}
