import { Hono } from 'hono';

import type { AppBindings } from '../app.js';

export function createPushKeyRoute(vapidPublicKey: string) {
  const route = new Hono<AppBindings>();

  route.get('/push/key', (c) => {
    return c.json({ publicKey: vapidPublicKey });
  });

  return route;
}
