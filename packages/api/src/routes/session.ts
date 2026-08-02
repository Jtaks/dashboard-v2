import type { Session } from '@dashboard/shared';
import { Hono } from 'hono';

import type { AppBindings } from '../app.js';
import { isAdmin } from '../middleware/admin.js';
import type { Identity } from '../middleware/identity.js';

export function createSessionRoute(autheliaLogoutUrl: string) {
  const route = new Hono<AppBindings>();

  route.get('/session', (c) => {
    const identity = c.get('identity') as Identity;
    const session: Session = {
      name: identity.name,
      email: identity.email,
      admin: isAdmin(identity.groups),
      logoutUrl: autheliaLogoutUrl,
    };

    return c.json(session);
  });

  return route;
}
