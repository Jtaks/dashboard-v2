import type { Context } from 'hono';

/** Configured group vocabulary plus `*` for the admin topic picker. */
export function adminTopicsHandler(
  groups: readonly string[],
): (c: Context) => Response {
  return (c) => c.json([...groups, '*']);
}
