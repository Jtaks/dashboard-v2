import type { StatusReport } from '@dashboard/shared';

import { apiJson } from './client.js';

export function fetchStatus(): Promise<StatusReport> {
  return apiJson<StatusReport>('/api/status');
}
