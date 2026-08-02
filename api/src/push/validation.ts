import { z } from 'zod';

/**
 * Browser `PushSubscription.toJSON()` body for upsert.
 * Unknown keys (e.g. `expirationTime`) are stripped; malformed bodies fail before any write.
 */
export const pushSubscriptionBodySchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

/** DELETE body: endpoint only. */
export const deletePushSubscriptionBodySchema = z.object({
  endpoint: z.string().min(1),
});

export type PushSubscriptionBody = z.infer<typeof pushSubscriptionBodySchema>;
export type DeletePushSubscriptionBody = z.infer<typeof deletePushSubscriptionBodySchema>;
