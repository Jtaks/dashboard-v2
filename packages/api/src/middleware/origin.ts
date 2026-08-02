import type { MiddlewareHandler } from 'hono';

import { ERROR_CODES } from '../lib/errors.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PATCH', 'DELETE']);

export function createOriginMiddleware(allowedOrigin: string): MiddlewareHandler {
  return async (c, next) => {
    if (!STATE_CHANGING_METHODS.has(c.req.method)) {
      await next();
      return;
    }

    const origin = c.req.header('Origin');

    if (!origin || origin !== allowedOrigin) {
      return c.json({ code: ERROR_CODES.originMismatch }, 403);
    }

    await next();
  };
}
