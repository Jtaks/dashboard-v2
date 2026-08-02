import type { StatusReport } from '@dashboard/shared';
import { Hono } from 'hono';

import type { AppBindings } from '../app.js';
import { getConfig } from '../config/get-config.js';
import type { Identity } from '../middleware/identity.js';
import { collectStatus, type StatusLogger } from '../status/collect-status.js';
import { filterStatusReport } from '../status/filter-status.js';
import { createStatusCache } from '../status/status-cache.js';

export type CreateStatusRouteOptions = {
  dockerProxyUrl: string;
  logger: StatusLogger;
};

export function createStatusRoute(options: CreateStatusRouteOptions) {
  const cache = createStatusCache({
    collect: () => collectStatus(getConfig(), options.dockerProxyUrl, options.logger),
  });

  const route = new Hono<AppBindings>();

  route.get('/status', async (c) => {
    const identity = c.get('identity') as Identity;
    const report = await cache.getUnfilteredReport();
    const filtered: StatusReport = filterStatusReport(report, getConfig(), identity.groups);

    return c.json(filtered);
  });

  return route;
}
