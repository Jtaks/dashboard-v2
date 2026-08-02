/** Aggregate health of an application or service. */
export type HealthStatus = 'up' | 'down' | 'degraded';

export function isHealthy(status: HealthStatus): boolean {
  return status === 'up';
}
