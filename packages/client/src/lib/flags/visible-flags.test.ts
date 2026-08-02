import { describe, expect, it } from 'vitest';

import { featureFlagRegistry } from './registry.js';
import { visibleFeatureFlags } from './visible-flags.js';

describe('visibleFeatureFlags', () => {
  it('lists only non-admin flags for a non-admin session', () => {
    const visible = visibleFeatureFlags(featureFlagRegistry, false);

    expect(visible.map((flag) => flag.feature)).toEqual(['dependencySummaryPopover']);
    expect(visible.every((flag) => flag.admin === false)).toBe(true);
  });

  it('lists every flag for an admin session', () => {
    const visible = visibleFeatureFlags(featureFlagRegistry, true);

    expect(visible.map((flag) => flag.feature)).toEqual([
      'dependencySummaryPopover',
      'adminExperimentalTools',
    ]);
  });

  it('does not include the list/grid view preference', () => {
    const visible = visibleFeatureFlags(featureFlagRegistry, true);

    expect(visible.some((flag) => flag.feature === 'dashboard.view')).toBe(false);
  });
});
