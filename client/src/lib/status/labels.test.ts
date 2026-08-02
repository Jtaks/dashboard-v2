import type { Status } from '@dashboard/shared';
import { describe, expect, it } from 'vitest';
import { statusAccessibleName, statusKeyLabel, statusNullLabel } from './labels.js';

describe('statusAccessibleName', () => {
  it('maps every status value to a Paraglide catalog string', () => {
    const expected: Record<Status, string> = {
      up: 'Up',
      starting: 'Starting',
      degraded: 'Degraded',
      down: 'Down',
      unknown: 'Unknown',
    };

    for (const status of Object.keys(expected) as Status[]) {
      expect(statusAccessibleName(status)).toBe(expected[status]);
    }
  });
});

describe('statusNullLabel', () => {
  it('resolves the null bucket from the catalog', () => {
    expect(statusNullLabel()).toBe('No containers');
  });
});

describe('statusKeyLabel', () => {
  it('covers status values and the null bucket', () => {
    expect(statusKeyLabel('down')).toBe('Down');
    expect(statusKeyLabel('null')).toBe('No containers');
  });
});
