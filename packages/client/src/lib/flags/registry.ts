import type { FeatureFlag } from '@dashboard/shared';

export const DEPENDENCY_SUMMARY_POPOVER_FLAG = 'dependencySummaryPopover';
export const ADMIN_EXPERIMENTAL_TOOLS_FLAG = 'adminExperimentalTools';

export const featureFlagRegistry: readonly FeatureFlag[] = [
  {
    feature: DEPENDENCY_SUMMARY_POPOVER_FLAG,
    description: 'flag_dependency_summary_popover_description',
    admin: false,
  },
  {
    feature: ADMIN_EXPERIMENTAL_TOOLS_FLAG,
    description: 'flag_admin_experimental_tools_description',
    admin: true,
  },
];
