import type { MiddlewareHandler } from 'hono';

import { ErrorCodes, jsonError } from '../errors.js';
import { isAdmin } from '../identity.js';
import type { AppVariables } from '../types.js';

/** Refuse non-members of adminGroup with 403; same JSON error shape as other failures. */
export function adminGuard(adminGroup: string): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (c, next) => {
    const identity = c.get('identity');
    if (!isAdmin(identity.groups, adminGroup)) {
      return jsonError(c, 403, ErrorCodes.forbidden);
    }
    await next();
  };
}
