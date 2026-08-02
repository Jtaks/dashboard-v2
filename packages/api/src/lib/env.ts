import { DEFAULT_VAPID_KEYS_PATH } from '../push/load-vapid-keys.js';

export const DEFAULT_DATABASE_PATH = '/data/dashboard.db';
export const DEFAULT_PORT = 3000;
export const DEFAULT_LOG_LEVEL = 'info';

export type Env = {
  configPath: string;
  databasePath: string;
  port: number;
  logLevel: string;
  allowedOrigin: string;
  autheliaLogoutUrl: string;
  dockerProxyUrl: string;
  vapidKeysPath: string;
  vapidSubject: string;
};

export function readEnv(overrides: Partial<Env> = {}): Env {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);

  return {
    configPath: overrides.configPath ?? process.env.CONFIG_PATH ?? '/config/dashboard.yaml',
    databasePath: overrides.databasePath ?? process.env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH,
    port: overrides.port ?? (Number.isFinite(port) ? port : DEFAULT_PORT),
    logLevel: overrides.logLevel ?? process.env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL,
    allowedOrigin: overrides.allowedOrigin ?? process.env.ALLOWED_ORIGIN ?? '',
    autheliaLogoutUrl: overrides.autheliaLogoutUrl ?? process.env.AUTHELIA_LOGOUT_URL ?? '',
    dockerProxyUrl: overrides.dockerProxyUrl ?? process.env.DOCKER_PROXY_URL ?? '',
    vapidKeysPath: overrides.vapidKeysPath ?? process.env.VAPID_KEYS_PATH ?? DEFAULT_VAPID_KEYS_PATH,
    vapidSubject: overrides.vapidSubject ?? process.env.VAPID_SUBJECT ?? '',
  };
}
