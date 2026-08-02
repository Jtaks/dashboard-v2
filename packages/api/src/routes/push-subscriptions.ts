import { Hono } from 'hono';

import { createPushSubscriptionsRepository } from '../push/push-subscriptions-repository.js';
import {
  pushSubscriptionBodySchema,
  pushSubscriptionDeleteBodySchema,
} from '../push/validation.js';
import type { AppBindings } from '../app.js';
import { getDatabase } from '../db/connection.js';
import { ERROR_CODES } from '../lib/errors.js';
import type { Identity } from '../middleware/identity.js';

export function createPushSubscriptionsRoute() {
  const route = new Hono<AppBindings>();

  route.post('/push/subscriptions', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = pushSubscriptionBodySchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ code: ERROR_CODES.badRequest }, 400);
    }

    const identity = c.get('identity') as Identity;
    const repository = createPushSubscriptionsRepository(getDatabase());

    repository.upsertWithTopics(
      {
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        userId: identity.user,
      },
      identity.groups,
    );

    return c.body(null, 204);
  });

  route.delete('/push/subscriptions', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = pushSubscriptionDeleteBodySchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ code: ERROR_CODES.badRequest }, 400);
    }

    const repository = createPushSubscriptionsRepository(getDatabase());
    repository.deleteByEndpoint(parsed.data.endpoint);

    return c.body(null, 204);
  });

  return route;
}
