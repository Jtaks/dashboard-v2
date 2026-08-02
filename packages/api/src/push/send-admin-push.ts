import type { PushResult, PushSend } from '@dashboard/shared';
import webpush from 'web-push';

import type { PushSubscriptionsRepository } from './push-subscriptions-repository.js';

export type SendNotification = (
  subscription: webpush.PushSubscription,
  payload: string | Buffer | null,
) => Promise<webpush.SendResult>;

function readStatusCode(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const statusCode = (error as { statusCode: unknown }).statusCode;
    return typeof statusCode === 'number' ? statusCode : undefined;
  }

  return undefined;
}

export async function sendAdminPush(
  repository: PushSubscriptionsRepository,
  payload: PushSend,
  sendNotification: SendNotification = webpush.sendNotification.bind(webpush),
): Promise<PushResult> {
  const endpoints = repository.endpointsForTopic(payload.topic);
  let failed = 0;
  const message = JSON.stringify(payload);

  for (const endpoint of endpoints) {
    const subscription = repository.getByEndpoint(endpoint);

    if (!subscription) {
      failed += 1;
      continue;
    }

    try {
      await sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        message,
      );
    } catch (error) {
      failed += 1;

      const statusCode = readStatusCode(error);
      if (statusCode === 404 || statusCode === 410) {
        repository.deleteByEndpoint(endpoint);
      }
    }
  }

  return {
    attempted: endpoints.length,
    failed,
  };
}
