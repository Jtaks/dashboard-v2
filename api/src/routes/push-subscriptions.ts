import type { Context } from 'hono';

import { getDb } from '../db/index.js';
import { ErrorCodes, jsonError } from '../errors.js';
import { deleteSubscription, rewriteTopics, upsertSubscription } from '../push/repository.js';
import {
  deletePushSubscriptionBodySchema,
  pushSubscriptionBodySchema,
} from '../push/validation.js';
import type { AppVariables } from '../types.js';

type PushEnv = { Variables: AppVariables };

async function readJsonBody(c: Context<PushEnv>): Promise<unknown | Response> {
  try {
    return await c.req.json();
  } catch {
    return jsonError(c, 400, ErrorCodes.invalidBody);
  }
}

export type PushSubscriptionHandlerOptions = {
  /** Clock for `created_at` / `last_seen_at` (tests). Default Date. */
  now?: () => Date;
};

/**
 * `POST /api/push/subscriptions` — upsert this device and rewrite topics from
 * live Remote-Groups in one transaction. Origin check is the A4 middleware.
 */
export function pushSubscribeHandler(
  options: PushSubscriptionHandlerOptions = {},
): (c: Context<PushEnv>) => Promise<Response> {
  const now = options.now ?? (() => new Date());

  return async (c) => {
    const raw = await readJsonBody(c);
    if (raw instanceof Response) {
      return raw;
    }

    const parsed = pushSubscriptionBodySchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(c, 400, ErrorCodes.invalidBody);
    }

    const identity = c.get('identity');
    const { endpoint, keys } = parsed.data;
    const db = getDb();

    db.transaction(() => {
      upsertSubscription(
        db,
        {
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userId: identity.user,
        },
        now,
      );
      rewriteTopics(db, endpoint, identity.groups);
    })();

    return c.body(null, 204);
  };
}

/**
 * `DELETE /api/push/subscriptions` — remove by endpoint; absent is still success.
 * Topics cascade via FK. Origin check is the A4 middleware.
 */
export function pushUnsubscribeHandler(): (c: Context<PushEnv>) => Promise<Response> {
  return async (c) => {
    const raw = await readJsonBody(c);
    if (raw instanceof Response) {
      return raw;
    }

    const parsed = deletePushSubscriptionBodySchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(c, 400, ErrorCodes.invalidBody);
    }

    deleteSubscription(getDb(), parsed.data.endpoint);
    return c.body(null, 204);
  };
}
