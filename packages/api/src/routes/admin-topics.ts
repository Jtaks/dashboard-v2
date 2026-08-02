import { Hono } from 'hono';

import { getConfig } from '../config/get-config.js';
import { adminMiddleware } from '../middleware/admin.js';

export function createAdminTopicsRoute() {
  const route = new Hono();

  route.get('/topics', adminMiddleware, (c) => {
    const config = getConfig();
    return c.json({ topics: [...config.groups, '*'] });
  });

  return route;
}
