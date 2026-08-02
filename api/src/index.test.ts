import { describe, expect, it } from 'vitest';

import { describeStatus } from './index.js';

describe('describeStatus', () => {
  it('echoes the shared health status', () => {
    expect(describeStatus('up')).toBe('up');
  });
});
