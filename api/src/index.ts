import type { HealthStatus } from '@dashboard/shared';
import { Hono } from 'hono';

export const app = new Hono();

app.get('/api/health', (c) => c.json({ status: 'ok' as const }));

/** Placeholder that keeps the shared contract wired into the API package. */
export function describeStatus(status: HealthStatus): string {
  return status;
}

export default app;
