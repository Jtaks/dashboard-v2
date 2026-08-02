import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CLIENT_ROUTE_MANIFEST, manifestRoutePatterns } from './manifest.js';

const routesDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../routes',
);

function toRoutePattern(segments: string[]): string {
  if (segments.length === 0) {
    return '/';
  }

  const normalized = segments.map((segment) =>
    segment.startsWith('[') && segment.endsWith(']') ? `:${segment.slice(1, -1)}` : segment,
  );

  return `/${normalized.join('/')}`;
}

function discoverRoutePatterns(directory: string, segments: string[] = []): string[] {
  const patterns: string[] = [];

  if (fs.existsSync(path.join(directory, '+page.svelte'))) {
    patterns.push(toRoutePattern(segments));
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }

    patterns.push(...discoverRoutePatterns(path.join(directory, entry.name), [...segments, entry.name]));
  }

  return patterns.sort();
}

describe('client route manifest', () => {
  it('covers every SvelteKit page route', () => {
    const discovered = discoverRoutePatterns(routesDirectory);
    expect(manifestRoutePatterns().sort()).toEqual(discovered);
  });

  it('assigns a keyboard suite to every manifest entry', () => {
    expect(CLIENT_ROUTE_MANIFEST.length).toBeGreaterThan(0);
    for (const entry of CLIENT_ROUTE_MANIFEST) {
      expect(entry.pattern).toMatch(/^\//);
      expect(entry.examplePath).toMatch(/^\//);
      expect(entry.suite).toBeTruthy();
    }
  });
});
