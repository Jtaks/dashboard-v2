import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { startServer } from './server.js';

/**
 * API package entry: compose HTTP after config load.
 * Startup order in {@link startServer}: config → DB migrate (A5) → VAPID (F1) → listen.
 */
export { createApp, type CreateAppOptions, type StatusAppOptions } from './app.js';
export { startServer, type StartServerOptions } from './server.js';
export { getConfig, loadConfig, loadConfigOrExit } from './config.js';
export {
  ensureDatabase,
  ensureDatabaseOrExit,
  getDb,
  openDatabase,
  resolveDatabasePath,
  runMigrations,
  DEFAULT_DATABASE_PATH,
} from './db/index.js';
export { loadEnv, loadEnvOrExit, type RuntimeEnv } from './env.js';
export { createLogger, type Logger } from './logging.js';
export { isAdmin, type Identity } from './identity.js';
export { ErrorCodes, type ApiErrorBody } from './errors.js';
export {
  deleteAlert,
  getAlertById,
  insertAlert,
  listAlerts,
  toAlert,
  updateAlert,
  SEVERITIES,
  createAlertBodySchema,
  patchAlertBodySchema,
  type AlertRecord,
  type InsertAlertInput,
  type UpdateAlertInput,
  type AlertSeverity,
  type CreateAlertBody,
  type PatchAlertBody,
} from './alerts/index.js';
export {
  configureWebPush,
  DEFAULT_VAPID_KEYS_PATH,
  deleteSubscription,
  ensureVapid,
  ensureVapidOrExit,
  getVapidConfig,
  getVapidPublicKey,
  listAllEndpoints,
  listEndpointsByTopic,
  listEndpointsByTopics,
  listTopicsForEndpoint,
  loadVapidKeys,
  loadVapidSubject,
  resetVapidForTests,
  resolveVapidKeysPath,
  rewriteTopics,
  upsertSubscription,
  VapidLoadError,
  type PushSubscriptionRecord,
  type UpsertPushSubscriptionInput,
  type VapidConfig,
  type VapidKeys,
} from './push/index.js';
export {
  collectStatus,
  createStatusCache,
  filterStatusReport,
  sinceForAggregate,
  STATUS_CACHE_TTL_MS,
  type CollectStatusOptions,
  type StatusCache,
  type StatusCacheOptions,
  type StatusCollectorLogger,
} from './status/index.js';
export {
  createDockerClient,
  DockerProxyError,
  mapContainerStatus,
  type ContainerSnapshot,
  type DockerClient,
} from './docker/index.js';
function isExecutedAsMain(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  try {
    return fileURLToPath(import.meta.url) === resolve(entry);
  } catch {
    return false;
  }
}

if (isExecutedAsMain()) {
  void startServer();
}
