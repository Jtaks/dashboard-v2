/**
 * Client route manifest for keyboard-navigation coverage.
 * Validated against `src/routes/` by manifest.test.ts — add an entry when a route is added.
 */
export type KeyboardSuiteId = 'list' | 'grid' | 'detail' | 'settings' | 'admin';

export type ClientRouteManifestEntry = {
  /** Route pattern derived from the SvelteKit file route, e.g. `/apps/:id`. */
  pattern: string;
  /** Concrete URL Playwright navigates to. */
  examplePath: string;
  suite: KeyboardSuiteId;
};

export const CLIENT_ROUTE_MANIFEST: readonly ClientRouteManifestEntry[] = [
  { pattern: '/', examplePath: '/', suite: 'list' },
  { pattern: '/settings', examplePath: '/settings', suite: 'settings' },
  { pattern: '/admin', examplePath: '/admin', suite: 'admin' },
  { pattern: '/apps/:id', examplePath: '/apps/media', suite: 'detail' },
] as const;

export function manifestRoutePatterns(): string[] {
  return CLIENT_ROUTE_MANIFEST.map((entry) => entry.pattern);
}
