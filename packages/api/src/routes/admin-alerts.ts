import type { Alert } from '@dashboard/shared';
import { Hono } from 'hono';

import { createAlertsRepository, type StoredAlert } from '../alerts/alerts-repository.js';
import { createAlertBodySchema, createAlertPatchSchema } from '../alerts/validation.js';
import type { AppBindings } from '../app.js';
import { getConfig } from '../config/get-config.js';
import { getDatabase } from '../db/connection.js';
import { ERROR_CODES } from '../lib/errors.js';
import { adminMiddleware } from '../middleware/admin.js';

function rowToResponse(row: StoredAlert): Alert {
  return {
    id: row.id,
    severity: row.severity,
    title: row.title,
    body: row.body,
    topic: row.topic,
    endsAt: row.ends_at,
    createdAt: row.created_at,
  };
}

export function createAdminAlertsRoute() {
  const route = new Hono<AppBindings>();

  route.get('/alerts', adminMiddleware, (c) => {
    const repository = createAlertsRepository(getDatabase());
    return c.json(repository.listAll());
  });

  route.post('/alerts', adminMiddleware, async (c) => {
    const config = getConfig();
    const body = await c.req.json().catch(() => null);
    const parsed = createAlertBodySchema(config.groups).safeParse(body);

    if (!parsed.success) {
      return c.json({ code: ERROR_CODES.badRequest }, 400);
    }

    const identity = c.get('identity');
    const repository = createAlertsRepository(getDatabase());
    const stored = repository.insert(parsed.data, identity.user);

    return c.json(rowToResponse(stored), 201);
  });

  route.patch('/alerts/:id', adminMiddleware, async (c) => {
    const config = getConfig();
    const body = await c.req.json().catch(() => null);
    const parsed = createAlertPatchSchema(config.groups).safeParse(body);

    if (!parsed.success) {
      return c.json({ code: ERROR_CODES.badRequest }, 400);
    }

    const repository = createAlertsRepository(getDatabase());
    const updated = repository.updateById(c.req.param('id'), parsed.data);

    if (!updated) {
      return c.json({ code: ERROR_CODES.notFound }, 404);
    }

    return c.json(rowToResponse(updated));
  });

  route.delete('/alerts/:id', adminMiddleware, (c) => {
    const repository = createAlertsRepository(getDatabase());
    const deleted = repository.deleteById(c.req.param('id'));

    if (!deleted) {
      return c.json({ code: ERROR_CODES.notFound }, 404);
    }

    return c.body(null, 204);
  });

  return route;
}
