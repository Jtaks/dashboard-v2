import { serve } from '@hono/node-server';

import { createApp } from './app.js';
import { getConfig, loadConfigOrExit, resolveConfigPath } from './config.js';
import { ensureDatabaseOrExit } from './db/index.js';
import { loadEnvOrExit } from './env.js';
import { asMessageLogger, createLogger } from './logging.js';
import { ensureVapidOrExit, type VapidConfig } from './push/vapid.js';

export type StartServerOptions = {
  /**
   * Override DB open + migrate (tests). Default: {@link ensureDatabaseOrExit}.
   */
  ensureDatabase?: () => void | Promise<void>;
  /**
   * Override VAPID load + web-push configure (tests). Default: {@link ensureVapidOrExit}.
   */
  ensureVapid?: () => VapidConfig | Promise<VapidConfig>;
};

/**
 * Load config, migrate DB, load VAPID, build the app, listen on PORT.
 * Prefer {@link createApp} in tests so no port is bound and VAPID can be injected or omitted.
 */
export async function startServer(options: StartServerOptions = {}): Promise<void> {
  const bootLogLevel = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  const logger = createLogger(
    bootLogLevel === 'debug' ||
      bootLogLevel === 'info' ||
      bootLogLevel === 'warn' ||
      bootLogLevel === 'error'
      ? bootLogLevel
      : 'info',
  );
  const messageLogger = asMessageLogger(logger);

  loadConfigOrExit(resolveConfigPath(), messageLogger);

  // A5: migrate-before-listen
  if (options.ensureDatabase) {
    await options.ensureDatabase();
  } else {
    ensureDatabaseOrExit(undefined, messageLogger);
  }

  // F1: VAPID keys + subject before listen (fail closed like config/DB)
  let vapid: VapidConfig;
  if (options.ensureVapid) {
    vapid = await options.ensureVapid();
  } else {
    vapid = ensureVapidOrExit(undefined, process.env, messageLogger);
  }

  const env = loadEnvOrExit(process.env, messageLogger);
  const app = createApp({
    config: getConfig(),
    env,
    logger,
    vapidPublicKey: vapid.publicKey,
  });

  serve({ fetch: app.fetch, port: env.port }, (info) => {
    logger.info({ msg: 'listening', port: info.port });
  });
}
