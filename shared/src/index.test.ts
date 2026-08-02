import { describe, expect, it } from 'vitest';

import { isHealthy } from './index.js';

describe('isHealthy', () => {
  it('returns true only for up', () => {
    expect(isHealthy('up')).toBe(true);
    expect(isHealthy('down')).toBe(false);
    expect(isHealthy('degraded')).toBe(false);
  });
});
