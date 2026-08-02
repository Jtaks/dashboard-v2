import type { Status } from '@dashboard/shared';

import type { ContainerSnapshot } from './types.js';

/**
 * Map a daemon container reading onto the TDD status vocabulary.
 * Derived from state + health only — never from probing the application.
 */
export function mapContainerStatus(snapshot: ContainerSnapshot | null): Status {
  if (snapshot === null) {
    return 'down';
  }

  const state = snapshot.state.toLowerCase();
  const health = snapshot.health?.toLowerCase() ?? null;

  switch (state) {
    case 'running': {
      if (health === 'unhealthy') {
        return 'degraded';
      }
      if (health === 'starting') {
        return 'starting';
      }
      // healthy, none, or no healthcheck declared → up
      return 'up';
    }
    case 'created':
      return 'starting';
    case 'restarting':
      return 'degraded';
    case 'exited':
    case 'dead':
    case 'removing':
    case 'paused':
      return 'down';
    default:
      // Unrecognised state: treat as down rather than inventing a reading.
      return 'down';
  }
}

/** Normalize Docker's StartedAt into an ISO string, or null when absent/zero. */
export function normalizeStartedAt(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  // Daemon uses year 0001 / 0000 when the container has never started.
  if (trimmed.startsWith('0001-') || trimmed.startsWith('0000-')) {
    return null;
  }
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) {
    return null;
  }
  return new Date(ms).toISOString();
}

/**
 * Extract health from a list/inspect payload.
 * Prefers Health.Status; falls back to parsing the human Status string.
 */
export function extractHealth(
  health: string | { Status?: string } | null | undefined,
  statusText?: string,
): string | null {
  if (typeof health === 'string' && health.length > 0) {
    return health.toLowerCase() === 'none' ? null : health.toLowerCase();
  }
  if (health && typeof health === 'object' && typeof health.Status === 'string') {
    const value = health.Status.toLowerCase();
    return value === 'none' ? null : value;
  }
  if (statusText) {
    if (/\(unhealthy\)/i.test(statusText)) {
      return 'unhealthy';
    }
    if (/\(healthy\)/i.test(statusText)) {
      return 'healthy';
    }
    if (/\(health:\s*starting\)/i.test(statusText)) {
      return 'starting';
    }
  }
  return null;
}
