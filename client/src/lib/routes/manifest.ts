/**
 * Canonical client route table for the SPA.
 *
 * The keyboard suite keys coverage off this list and
 * `manifest.test.ts` cross-checks it against SvelteKit's generated dictionary,
 * so a new `+page` without suite coverage fails the build.
 */
export const CLIENT_ROUTE_MANIFEST = ['/', '/applications/[id]', '/settings', '/admin'] as const;

export type ClientRoutePath = (typeof CLIENT_ROUTE_MANIFEST)[number];
