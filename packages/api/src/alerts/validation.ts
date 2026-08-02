import type { Severity } from '@dashboard/shared';
import { z } from 'zod';

export const SEVERITIES = ['info', 'success', 'warning', 'error'] as const satisfies readonly Severity[];

export function isValidTopic(topic: string, groups: readonly string[]): boolean {
  return topic === '*' || groups.includes(topic);
}

export function createAlertBodySchema(groups: readonly string[]) {
  return z.object({
    severity: z.enum(SEVERITIES),
    title: z.string().min(1),
    body: z.string().nullable(),
    topic: z.string().refine((topic) => isValidTopic(topic, groups), {
      message: 'topic must be * or a configured group',
    }),
    endsAt: z.string().datetime().nullable(),
  });
}

export function createAlertPatchSchema(groups: readonly string[]) {
  return createAlertBodySchema(groups).partial();
}

export type AlertBody = z.infer<ReturnType<typeof createAlertBodySchema>>;
export type AlertPatch = z.infer<ReturnType<typeof createAlertPatchSchema>>;
