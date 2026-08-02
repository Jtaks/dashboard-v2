import { describe, expect, it } from 'vitest';

import { statusAccessibleName } from './label.js';

describe('statusAccessibleName', () => {
  it('maps each status value to the catalog label', () => {
    expect(statusAccessibleName('up')).toBe('Up');
    expect(statusAccessibleName('starting')).toBe('Starting');
    expect(statusAccessibleName('degraded')).toBe('Degraded');
    expect(statusAccessibleName('down')).toBe('Down');
    expect(statusAccessibleName('unknown')).toBe('Unknown');
  });

  it('returns null for a missing status', () => {
    expect(statusAccessibleName(null)).toBeNull();
  });
});
