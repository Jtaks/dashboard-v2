import type { HealthStatus } from '@dashboard/shared';

/** Placeholder that keeps the shared contract wired into the client package. */
export function labelStatus(status: HealthStatus): string {
  return status;
}
