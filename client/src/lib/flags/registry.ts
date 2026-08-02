import type { FeatureFlag } from '@dashboard/shared';

/**
 * C4: when on, dependency summaries use a hover popover; when off (default), an inline expander.
 * Stable id for consumers — do not rename without a migration plan.
 */
export const STATUS_SUMMARY_POPOVER = 'status-summary-popover';

/**
 * Client-declared feature flag registry (TDD Feature flags).
 * `description` is a Paraglide message id; resolve at display time.
 * List/grid view is not a flag — it lives under STORAGE_KEYS.view.
 */
export const FEATURE_FLAGS: readonly FeatureFlag[] = [
  {
    feature: STATUS_SUMMARY_POPOVER,
    description: 'flag_status_summary_popover',
    admin: false,
  },
  {
    // Admin-only listing example; capability still enforced by the API (TDD Feature flags).
    feature: 'admin-status-detail',
    description: 'flag_admin_status_detail',
    admin: true,
  },
];

/** Flags visible on the settings page for the given session admin bit. */
export function visibleFlags(
  flags: readonly FeatureFlag[],
  isAdmin: boolean,
): FeatureFlag[] {
  return flags.filter((flag) => !flag.admin || isAdmin);
}
