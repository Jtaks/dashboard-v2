import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

describe('api package', () => {
  it('exports a Hono application factory', () => {
    expect(createApp).toBeTypeOf('function');
  });
});
