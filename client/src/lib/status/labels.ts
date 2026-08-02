import type { Status } from '@dashboard/shared';
import { m } from '$lib/paraglide/messages.js';

/**
 * Accessible / visible name for a status value from the Paraglide catalog.
 * Never inline a status label in a component — call this instead.
 */
export function statusAccessibleName(status: Status): string {
  switch (status) {
    case 'up':
      return m.status_up();
    case 'starting':
      return m.status_starting();
    case 'degraded':
      return m.status_degraded();
    case 'down':
      return m.status_down();
    case 'unknown':
      return m.status_unknown();
  }
}

/** Label for the null / no-containers bucket in dependency summaries. */
export function statusNullLabel(): string {
  return m.status_null();
}

/** Label for any status key including the null bucket. */
export function statusKeyLabel(key: Status | 'null'): string {
  return key === 'null' ? statusNullLabel() : statusAccessibleName(key);
}
