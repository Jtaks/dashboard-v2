import type { Status } from '@dashboard/shared';
import * as m from '$lib/paraglide/messages';

export function statusAccessibleName(status: Status | null): string | null {
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
    case null:
      return null;
  }
}
