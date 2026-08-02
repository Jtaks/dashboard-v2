import type { Alert } from '@dashboard/shared';
import type { Context } from 'hono';

import { filterAlertsForUser, listAlerts, toAlert } from '../alerts/index.js';
import { getDb } from '../db/index.js';
import type { AppVariables } from '../types.js';

/** GET /api/alerts — live alerts targeted at the caller's Remote-Groups. */
export function alertsHandler(): (c: Context<{ Variables: AppVariables }>) => Response {
  return (c) => {
    const identity = c.get('identity');
    const alerts: Alert[] = filterAlertsForUser(listAlerts(getDb()), identity.groups).map(toAlert);
    return c.json(alerts);
  };
}
