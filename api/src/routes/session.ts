import type { Session } from '@dashboard/shared';
import type { Context } from 'hono';

import { isAdmin } from '../identity.js';
import type { AppVariables } from '../types.js';

export function sessionHandler(
  adminGroup: string,
  logoutUrl: string,
): (c: Context<{ Variables: AppVariables }>) => Response {
  return (c) => {
    const identity = c.get('identity');
    const body: Session = {
      name: identity.name,
      email: identity.email,
      admin: isAdmin(identity.groups, adminGroup),
      logoutUrl,
    };
    return c.json(body);
  };
}
