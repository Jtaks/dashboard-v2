import type { Session } from '@dashboard/shared';

import { apiJson } from './client.js';

export function fetchSession(): Promise<Session> {
  return apiJson<Session>('/api/session');
}
