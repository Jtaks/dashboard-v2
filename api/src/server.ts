import { serve } from '@hono/node-server';

import { createApp } from './app.js';
import { getConfig, loadConfigOrExit, resolveConfigPath } from './config.js';
import { ensureDatabaseOrExit } from './db/index.js';
import { loadEnvOrExit } from './env.js';
import { asMessageLogger, createLogger } from './logging.js';

export type StartServerOptions = {
  /**
   * Override DB open + migrate (tests). Default: {@link ensureDatabaseOrExit}.
   */
  ensureDatabase?: () => void | Promise<void>;
};

/**
 * Load config, migrate DB, build the app, listen on PORT.
 * Prefer {@link createApp} in tests so no port is bound.
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

  const env = loadEnvOrExit(process.env, messageLogger);
  const app = createApp({ config: getConfig(), env, logger });

  serve({ fetch: app.fetch, port: env.port }, (info) => {
    logger.info({ msg: 'listening', port: info.port });
  });
}
