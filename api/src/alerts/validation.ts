import { z } from 'zod';

/** Severity members matching the shared Severity union. */
export const SEVERITIES = ['info', 'success', 'warning', 'error'] as const;

export type AlertSeverity = (typeof SEVERITIES)[number];

/**
 * Build create-body schema against a configured groups vocabulary plus `*`.
 * Unknown keys (id, created_by, createdAt, …) are stripped; authorship is never taken from the body.
 */
export function createAlertBodySchema(groups: readonly string[]) {
  return z.object({
    severity: z.enum(SEVERITIES),
    title: z.string().min(1),
    body: z.string().nullable().optional(),
    endsAt: z.string().nullable().optional(),
    topic: topicSchema(groups),
  });
}

/** Partial update under the same field rules as create. Unknown keys are stripped. */
export function patchAlertBodySchema(groups: readonly string[]) {
  return z.object({
    severity: z.enum(SEVERITIES).optional(),
    title: z.string().min(1).optional(),
    body: z.string().nullable().optional(),
    endsAt: z.string().nullable().optional(),
    topic: topicSchema(groups).optional(),
  });
}

function topicSchema(groups: readonly string[]) {
  return z.string().refine((topic) => topic === '*' || groups.includes(topic), {
    message: 'topic must be * or a configured group',
  });
}

export type CreateAlertBody = z.infer<ReturnType<typeof createAlertBodySchema>>;
export type PatchAlertBody = z.infer<ReturnType<typeof patchAlertBodySchema>>;
