import { z } from 'zod';

import { isValidTopic } from '../alerts/validation.js';

export const pushSubscriptionBodySchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const pushSubscriptionDeleteBodySchema = z.object({
  endpoint: z.string().min(1),
});

export function createPushSendSchema(groups: readonly string[]) {
  return z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    url: z.string().nullable(),
    topic: z.string().refine((topic) => isValidTopic(topic, groups), {
      message: 'topic must be * or a configured group',
    }),
  });
}

export type PushSendBody = z.infer<ReturnType<typeof createPushSendSchema>>;
