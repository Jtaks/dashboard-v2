import { test } from '@playwright/test';

import { assertAllRoutesCovered } from './helpers.js';

test.describe('keyboard / coverage', () => {
  test('every client route manifest entry has keyboard suite coverage', () => {
    assertAllRoutesCovered();
  });
});
