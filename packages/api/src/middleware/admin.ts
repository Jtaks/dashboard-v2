import type { MiddlewareHandler } from 'hono';

import { getConfig } from '../config/get-config.js';
import { ERROR_CODES } from '../lib/errors.js';
import type { Identity } from './identity.js';

export function isAdmin(groups: string[]): boolean {
  return groups.includes(getConfig().adminGroup);
}

export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  const identity = c.get('identity') as Identity;

  if (!isAdmin(identity.groups)) {
    return c.json({ code: ERROR_CODES.forbidden }, 403);
  }

  await next();
};
