import { Hono } from 'hono';

import type { AppBindings } from '../app.js';
import { getConfig } from '../config/get-config.js';
import { getDatabase } from '../db/connection.js';
import { ERROR_CODES } from '../lib/errors.js';
import { adminMiddleware } from '../middleware/admin.js';
import { createPushSubscriptionsRepository } from '../push/push-subscriptions-repository.js';
import { sendAdminPush } from '../push/send-admin-push.js';
import { createPushSendSchema } from '../push/validation.js';

export function createAdminPushRoute() {
  const route = new Hono<AppBindings>();

  route.post('/push', adminMiddleware, async (c) => {
    const config = getConfig();
    const body = await c.req.json().catch(() => null);
    const parsed = createPushSendSchema(config.groups).safeParse(body);

    if (!parsed.success) {
      return c.json({ code: ERROR_CODES.badRequest }, 400);
    }

    const repository = createPushSubscriptionsRepository(getDatabase());
    const result = await sendAdminPush(repository, parsed.data);

    return c.json(result);
  });

  return route;
}
