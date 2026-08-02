import type { Context } from 'hono';

import type { AppVariables } from '../types.js';

/**
 * `GET /api/push/key` — return only the VAPID public key.
 * Identity middleware already rejects unauthenticated requests.
 * The private key must never appear in the body.
 */
export function pushKeyHandler(
  publicKey: string,
): (c: Context<{ Variables: AppVariables }>) => Response {
  return (c) => c.json({ publicKey });
}
