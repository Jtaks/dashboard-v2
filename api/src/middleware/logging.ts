import type { MiddlewareHandler } from 'hono';

import type { Logger } from '../logging.js';
import type { AppVariables } from '../types.js';

/**
 * Structured request log: route and outcome only — never header values.
 */
export function requestLoggingMiddleware(
  logger: Logger,
): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (c, next) => {
    const method = c.req.method;
    const path = c.req.path;
    try {
      await next();
      logger.info({
        msg: 'request',
        method,
        path,
        status: c.res.status,
      });
    } catch (err) {
      logger.error({
        msg: 'request',
        method,
        path,
        status: 500,
        error: err instanceof Error ? err.name : 'unknown',
      });
      throw err;
    }
  };
}
