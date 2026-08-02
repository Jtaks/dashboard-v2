import { Hono } from 'hono';

import { createAlertsRepository } from '../alerts/alerts-repository.js';
import type { AppBindings } from '../app.js';
import { getDatabase } from '../db/connection.js';
import type { Identity } from '../middleware/identity.js';

export function createAlertsRoute() {
  const route = new Hono<AppBindings>();

  route.get('/alerts', (c) => {
    const identity = c.get('identity') as Identity;
    const repository = createAlertsRepository(getDatabase());

    return c.json(repository.listForGroups(identity.groups));
  });

  return route;
}
