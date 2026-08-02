export const DEFAULT_PORT = 3000;
export const DEFAULT_LOG_LEVEL = 'info';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Runtime env from TDD Deployment (not the YAML catalog config). */
export type RuntimeEnv = {
  port: number;
  logLevel: LogLevel;
  allowedOrigin: string;
  autheliaLogoutUrl: string;
  /** Base URL of the read-only Docker socket proxy. Optional so unit tests need not set it. */
  dockerProxyUrl: string | undefined;
};

export type EnvLogger = {
  error: (message: string) => void;
};

const LOG_LEVELS = new Set<LogLevel>(['debug', 'info', 'warn', 'error']);

const defaultLogger: EnvLogger = {
  error: (message) => console.error(message),
};

export class EnvLoadError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid environment: ${issues.join('; ')}`);
    this.name = 'EnvLoadError';
    this.issues = issues;
  }
}

/**
 * Read and validate process env used by the HTTP service.
 * ALLOWED_ORIGIN and AUTHELIA_LOGOUT_URL are required (no defaults).
 */
export function loadEnv(env: NodeJS.ProcessEnv = process.env): RuntimeEnv {
  const issues: string[] = [];

  const allowedOrigin = env.ALLOWED_ORIGIN?.trim();
  if (!allowedOrigin) {
    issues.push('ALLOWED_ORIGIN is required');
  }

  const autheliaLogoutUrl = env.AUTHELIA_LOGOUT_URL?.trim();
  if (!autheliaLogoutUrl) {
    issues.push('AUTHELIA_LOGOUT_URL is required');
  }

  const logLevelRaw = (env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL).trim().toLowerCase();
  if (!LOG_LEVELS.has(logLevelRaw as LogLevel)) {
    issues.push(`LOG_LEVEL must be one of ${[...LOG_LEVELS].join(', ')}`);
  }

  const portRaw = env.PORT ?? String(DEFAULT_PORT);
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    issues.push('PORT must be an integer between 1 and 65535');
  }

  if (issues.length > 0 || !allowedOrigin || !autheliaLogoutUrl) {
    throw new EnvLoadError(issues);
  }

  const dockerProxyRaw = env.DOCKER_PROXY_URL?.trim();
  const dockerProxyUrl = dockerProxyRaw ? dockerProxyRaw.replace(/\/+$/, '') : undefined;

  return {
    port,
    logLevel: logLevelRaw as LogLevel,
    allowedOrigin,
    autheliaLogoutUrl,
    dockerProxyUrl,
  };
}

/** Load env or log every issue and exit non-zero. */
export function loadEnvOrExit(
  env: NodeJS.ProcessEnv = process.env,
  logger: EnvLogger = defaultLogger,
  exit: (code: number) => never = (code) => process.exit(code) as never,
): RuntimeEnv {
  try {
    return loadEnv(env);
  } catch (err) {
    if (err instanceof EnvLoadError) {
      for (const issue of err.issues) {
        logger.error(`env: ${issue}`);
      }
    } else {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`env: ${message}`);
    }
    exit(1);
  }
}
