import type { FeatureFlag } from '@dashboard/shared';
import { m } from '$lib/paraglide/messages.js';

const resolvers: Record<string, () => string> = {
  flag_status_summary_popover: () => m.flag_status_summary_popover(),
  flag_admin_status_detail: () => m.flag_admin_status_detail(),
};

/** Resolve a registry `description` message id via Paraglide. */
export function resolveFlagDescription(flag: FeatureFlag): string {
  const resolve = resolvers[flag.description];
  return resolve ? resolve() : flag.description;
}
