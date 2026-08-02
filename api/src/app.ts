import type { StatusReport } from '@dashboard/shared';
import { Hono } from 'hono';

import type { ResolvedConfig } from './config.js';
import type { RuntimeEnv } from './env.js';
import { ErrorCodes, jsonError } from './errors.js';
import { createLogger, type Logger } from './logging.js';
import { adminGuard } from './middleware/admin.js';
import { identityMiddleware } from './middleware/identity.js';
import { requestLoggingMiddleware } from './middleware/logging.js';
import { originMiddleware } from './middleware/origin.js';
import {
  adminCreateAlertHandler,
  adminDeleteAlertHandler,
  adminListAlertsHandler,
  adminPatchAlertHandler,
} from './routes/admin-alerts.js';
import { adminTopicsHandler } from './routes/admin-topics.js';
import { alertsHandler } from './routes/alerts.js';
import { catalogHandler } from './routes/catalog.js';
import { sessionHandler } from './routes/session.js';
import { statusHandler } from './routes/status.js';
import { createStatusCache, STATUS_CACHE_TTL_MS } from './status/cache.js';
import { collectStatus } from './status/collect.js';
import type { AppVariables } from './types.js';

export type StatusAppOptions = {
  /** Override unfiltered collection (tests). Default: collectStatus via DOCKER_PROXY_URL. */
  collect?: () => Promise<StatusReport>;
  /** Clock for the shared cache TTL (tests). Default Date.now. */
  now?: () => number;
  /** Cache window in ms. Default {@link STATUS_CACHE_TTL_MS}. */
  ttlMs?: number;
};

export type CreateAppOptions = {
  config: ResolvedConfig;
  env: RuntimeEnv;
  logger?: Logger;
  /**
   * Extension/test hook: register extra routes on the `/api` sub-app after
   * identity and origin middleware (used by integration tests for CSRF probes).
   */
  registerApi?: (api: Hono<{ Variables: AppVariables }>) => void;
  /** Status collection / cache hooks (tests). */
  status?: StatusAppOptions;
};

/**
 * Build the Hono app without binding a port.
 * Middleware order on `/api`: logging → identity → origin → routes (admin guard on admin routes).
 */
export function createApp(options: CreateAppOptions): Hono<{ Variables: AppVariables }> {
  const { config, env } = options;
  const logger = options.logger ?? createLogger(env.logLevel);

  const collect =
    options.status?.collect ??
    (() =>
      collectStatus(config, {
        dockerProxyUrl: env.dockerProxyUrl,
        logger: {
          warn: (fields) => logger.warn(fields),
        },
      }));

  const statusCache = createStatusCache({
    collect,
    now: options.status?.now,
    ttlMs: options.status?.ttlMs ?? STATUS_CACHE_TTL_MS,
  });

  const app = new Hono<{ Variables: AppVariables }>();

  app.use('*', requestLoggingMiddleware(logger));

  const api = new Hono<{ Variables: AppVariables }>();
  api.use('*', identityMiddleware());
  api.use('*', originMiddleware(env.allowedOrigin));

  api.get('/session', sessionHandler(config.adminGroup, env.autheliaLogoutUrl));
  api.get('/catalog', catalogHandler(config));
  api.get('/status', statusHandler(config, statusCache));
  api.get('/alerts', alertsHandler());

  const admin = new Hono<{ Variables: AppVariables }>();
  admin.use('*', adminGuard(config.adminGroup));
  admin.get('/topics', adminTopicsHandler(config.groups));
  admin.get('/alerts', adminListAlertsHandler());
  admin.post('/alerts', adminCreateAlertHandler(config.groups));
  admin.patch('/alerts/:id', adminPatchAlertHandler(config.groups));
  admin.delete('/alerts/:id', adminDeleteAlertHandler());
  api.route('/admin', admin);

  options.registerApi?.(api);

  api.notFound((c) => jsonError(c, 404, ErrorCodes.notFound));
  app.route('/api', api);

  app.notFound((c) => jsonError(c, 404, ErrorCodes.notFound));

  app.onError((err, c) => {
    logger.error({
      msg: 'unhandled',
      method: c.req.method,
      path: c.req.path,
      error: err instanceof Error ? err.name : 'unknown',
    });
    return jsonError(c, 500, ErrorCodes.internalError);
  });

  return app;
}
