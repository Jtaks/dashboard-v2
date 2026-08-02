import type { Session } from '@dashboard/shared';
import { apiFetch } from '$lib/api/client.js';

export const sessionQueryKey = ['session'] as const;

export function fetchSession(): Promise<Session> {
  return apiFetch<Session>('/api/session');
}
