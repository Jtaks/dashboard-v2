import type { MiddlewareHandler } from 'hono';

import { ERROR_CODES } from '../lib/errors.js';

export type Identity = {
  user: string;
  groups: string[];
  email: string;
  name: string;
};

function parseGroups(header: string | undefined): string[] {
  if (!header) {
    return [];
  }

  return header
    .split(',')
    .map((group) => group.trim())
    .filter((group) => group.length > 0);
}

export const identityMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.req.header('Remote-User');
  const groupsHeader = c.req.header('Remote-Groups');

  if (!user || !groupsHeader) {
    return c.json({ code: ERROR_CODES.unauthorized }, 401);
  }

  const groups = parseGroups(groupsHeader);

  if (groups.length === 0) {
    return c.json({ code: ERROR_CODES.unauthorized }, 401);
  }

  c.set('identity', {
    user,
    groups,
    email: c.req.header('Remote-Email') ?? '',
    name: c.req.header('Remote-Name') ?? '',
  } satisfies Identity);

  await next();
};
