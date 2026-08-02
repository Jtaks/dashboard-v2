/** Environment variables read by the API — kept in sync with integrator docs. */
export const ENV_VARIABLES = [
  'CONFIG_PATH',
  'DATABASE_PATH',
  'VAPID_KEYS_PATH',
  'VAPID_SUBJECT',
  'DOCKER_PROXY_URL',
  'ALLOWED_ORIGIN',
  'AUTHELIA_LOGOUT_URL',
  'PORT',
  'LOG_LEVEL',
] as const;

export type EnvVariable = (typeof ENV_VARIABLES)[number];
