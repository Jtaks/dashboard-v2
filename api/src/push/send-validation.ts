import { z } from 'zod';

/**
 * Build PushSend body schema against a configured groups vocabulary plus `*`.
 * Title and body are required; url is nullable; topic is `*` or a configured group.
 */
export function pushSendBodySchema(groups: readonly string[]) {
  return z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    url: z.string().nullable(),
    topic: z.string().refine((topic) => topic === '*' || groups.includes(topic), {
      message: 'topic must be * or a configured group',
    }),
  });
}

export type PushSendBody = z.infer<ReturnType<typeof pushSendBodySchema>>;
