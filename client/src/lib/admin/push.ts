import type { PushResult, PushSend } from '@dashboard/shared';
import { apiFetch } from '$lib/api/client.js';

/** POST /api/admin/push — dispatch a push; returns attempted/failed counts only. */
export function sendAdminPush(body: PushSend): Promise<PushResult> {
  return apiFetch<PushResult>('/api/admin/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
