import type { FeatureFlag } from '@dashboard/shared';

export function visibleFeatureFlags(
  registry: readonly FeatureFlag[],
  isAdmin: boolean,
): readonly FeatureFlag[] {
  return registry.filter((flag) => !flag.admin || isAdmin);
}
