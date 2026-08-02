import type { MiddlewareHandler } from 'hono';

import { ErrorCodes, jsonError } from '../errors.js';
import { identityFromHeaders } from '../identity.js';
import type { AppVariables } from '../types.js';

/**
 * Require Remote-User, Remote-Groups, Remote-Email, and Remote-Name.
 * Fails closed with 401 when any are absent; never reaches the handler.
 */
export function identityMiddleware(): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (c, next) => {
    const identity = identityFromHeaders({
      user: c.req.header('Remote-User'),
      groups: c.req.header('Remote-Groups'),
      email: c.req.header('Remote-Email'),
      name: c.req.header('Remote-Name'),
    });

    if (!identity) {
      return jsonError(c, 401, ErrorCodes.unauthorized);
    }

    c.set('identity', identity);
    await next();
  };
}
