import { Hono } from 'hono';

import { ERROR_CODES } from './lib/errors.js';
import { createLogger } from './lib/logger.js';
import { adminMiddleware } from './middleware/admin.js';
import { identityMiddleware } from './middleware/identity.js';
import { createOriginMiddleware } from './middleware/origin.js';
import { createAdminAlertsRoute } from './routes/admin-alerts.js';
import { createAdminPushRoute } from './routes/admin-push.js';
import { createAlertsRoute } from './routes/alerts.js';
import { createAdminTopicsRoute } from './routes/admin-topics.js';
import { createCatalogRoute } from './routes/catalog.js';
import { createPushKeyRoute } from './routes/push-key.js';
import { createPushSubscriptionsRoute } from './routes/push-subscriptions.js';
import { createSessionRoute } from './routes/session.js';
import { createStatusRoute } from './routes/status.js';

export type AppBindings = {
  Variables: {
    identity: import('./middleware/identity.js').Identity;
  };
};

export type CreateAppOptions = {
  allowedOrigin: string;
  autheliaLogoutUrl: string;
  dockerProxyUrl: string;
  vapidPublicKey: string;
  logLevel?: string;
};

export function createApp(options: CreateAppOptions) {
  const logger = createLogger(options.logLevel ?? 'info');
  const app = new Hono<AppBindings>();

  app.use('/api/*', async (c, next) => {
    await next();
    logger.request(c.req.path, c.res.status);
  });

  app.use('/api/*', identityMiddleware);
  app.use('/api/*', createOriginMiddleware(options.allowedOrigin));

  const api = new Hono<AppBindings>();
  api.route('/', createSessionRoute(options.autheliaLogoutUrl));
  api.route('/', createCatalogRoute());
  api.route('/', createStatusRoute({ dockerProxyUrl: options.dockerProxyUrl, logger }));
  api.route('/', createAlertsRoute());
  api.route('/', createPushKeyRoute(options.vapidPublicKey));
  api.route('/', createPushSubscriptionsRoute());

  const admin = new Hono<AppBindings>();
  admin.use('*', adminMiddleware);
  admin.route('/', createAdminTopicsRoute());
  admin.route('/', createAdminAlertsRoute());
  admin.route('/', createAdminPushRoute());
  api.route('/admin', admin);

  app.route('/api', api);

  app.notFound((c) => c.json({ code: ERROR_CODES.notFound }, 404));

  app.onError((error, c) => {
    logger.error('unhandled error', { route: c.req.path, message: error.message });
    return c.json({ code: ERROR_CODES.internal }, 500);
  });

  return app;
}
