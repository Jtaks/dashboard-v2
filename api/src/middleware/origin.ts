import type { MiddlewareHandler } from 'hono';

import { ErrorCodes, jsonError } from '../errors.js';
import type { AppVariables } from '../types.js';

const STATE_CHANGING = new Set(['POST', 'PATCH', 'DELETE']);

/**
 * CSRF: state-changing methods must carry Origin exactly equal to ALLOWED_ORIGIN.
 * Refuses before the handler runs.
 */
export function originMiddleware(
  allowedOrigin: string,
): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (c, next) => {
    if (STATE_CHANGING.has(c.req.method)) {
      const origin = c.req.header('Origin');
      if (origin !== allowedOrigin) {
        return jsonError(c, 403, ErrorCodes.invalidOrigin);
      }
    }
    await next();
  };
}
