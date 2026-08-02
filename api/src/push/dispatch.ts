import type { PushResult, PushSend } from '@dashboard/shared';
import type Database from 'better-sqlite3';
import webpush from 'web-push';

import { resolvePushAudience } from './audience.js';
import { deleteSubscription, type PushSubscriptionRecord } from './repository.js';

/** Injectable sender for tests; production uses web-push. */
export type PushSender = (
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  },
  payload: string,
) => Promise<void>;

export type DispatchPushOptions = {
  /** Override web-push sendNotification (integration tests). */
  send?: PushSender;
};

function statusCodeFromError(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const code = (err as { statusCode: unknown }).statusCode;
    if (typeof code === 'number') {
      return code;
    }
  }
  return undefined;
}

function toWebPushSubscription(record: PushSubscriptionRecord) {
  return {
    endpoint: record.endpoint,
    keys: {
      p256dh: record.p256dh,
      auth: record.auth,
    },
  };
}

const defaultSend: PushSender = async (subscription, payload) => {
  await webpush.sendNotification(subscription, payload);
};

/**
 * Dispatch a PushSend payload to every distinct endpoint in the topic audience.
 * 404/410 → delete the subscription row and count failed.
 * Any other failure → count failed, leave the row.
 * Does not log or store title, body, or url.
 */
export async function dispatchPush(
  db: Database.Database,
  payload: PushSend,
  options: DispatchPushOptions = {},
): Promise<PushResult> {
  const endpoints = resolvePushAudience(db, payload.topic);
  const send = options.send ?? defaultSend;
  // Serialise as PushSend so the F3 worker reads one shape.
  const body = JSON.stringify(payload);

  let failed = 0;

  for (const record of endpoints) {
    try {
      await send(toWebPushSubscription(record), body);
    } catch (err) {
      failed += 1;
      const status = statusCodeFromError(err);
      if (status === 404 || status === 410) {
        deleteSubscription(db, record.endpoint);
      }
    }
  }

  return { attempted: endpoints.length, failed };
}
