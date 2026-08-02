import type { Alert } from '@dashboard/shared';

import { apiJson } from './client.js';

export function fetchAlerts(): Promise<Alert[]> {
  return apiJson<Alert[]>('/api/alerts');
}
