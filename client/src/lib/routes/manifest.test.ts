import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CLIENT_ROUTE_MANIFEST } from './manifest.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Paths from SvelteKit's generated client route dictionary. */
function readSvelteKitRoutes(): string[] {
  const appJs = join(here, '../../../.svelte-kit/generated/client/app.js');
  const source = readFileSync(appJs, 'utf8');
  const match = source.match(/export const dictionary = (\{[\s\S]*?\});/);
  if (!match?.[1]) {
    throw new Error(`Could not parse route dictionary from ${appJs}`);
  }
  const dictionary = Function(`"use strict"; return (${match[1]})`)() as Record<string, unknown>;
  return Object.keys(dictionary).sort();
}

describe('client route manifest', () => {
  it('matches SvelteKit generated routes exactly', () => {
    expect([...CLIENT_ROUTE_MANIFEST].sort()).toEqual(readSvelteKitRoutes());
  });
});
