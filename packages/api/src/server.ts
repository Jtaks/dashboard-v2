import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';

import { createApp } from './app.js';
import { initConfig } from './config/get-config.js';
import { logConfigError } from './config/load-config.js';
import { openDatabase } from './db/connection.js';
import { runMigrationsOrExit } from './db/migrate.js';
import { readEnv } from './lib/env.js';
import { initPush } from './push/init-push.js';

export function startServer(env = readEnv()) {
  try {
    initConfig(env.configPath);
  } catch (error) {
    logConfigError(error);
    process.exit(1);
    throw error;
  }

  const pushConfig = initPush({
    vapidKeysPath: env.vapidKeysPath,
    vapidSubject: env.vapidSubject,
  });

  const db = openDatabase(env.databasePath);
  runMigrationsOrExit(db);

  const app = createApp({
    allowedOrigin: env.allowedOrigin,
    autheliaLogoutUrl: env.autheliaLogoutUrl,
    dockerProxyUrl: env.dockerProxyUrl,
    logLevel: env.logLevel,
    vapidPublicKey: pushConfig.publicKey,
  });

  serve(
    {
      fetch: app.fetch,
      port: env.port,
    },
    (info) => {
      console.info(`API listening on port ${info.port}`);
    },
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
