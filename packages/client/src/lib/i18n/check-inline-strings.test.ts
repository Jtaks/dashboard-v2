import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { findInlineStringViolations, findInlineStrings } from './check-inline-strings.js';

const sourceRoots = [
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../routes'),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../lib/components'),
];

describe('inline user-facing strings', () => {
  it('passes when route copy lives in the Paraglide catalog', async () => {
    const violations = (
      await Promise.all(sourceRoots.map((directory) => findInlineStringViolations(directory)))
    ).flat();
    expect(violations).toEqual([]);
  });

  it('fails when a literal is added to a route component', () => {
    const violations = findInlineStrings('<main><p>Inline copy belongs in the catalog</p></main>');
    expect(violations.length).toBeGreaterThan(0);
  });
});
