import { readFileSync } from 'node:fs';
import {
  configSchema,
  type ApplicationConfig,
  type Config,
  type ServiceConfig,
} from '@dashboard/shared';
import { parse as parseYaml } from 'yaml';

/** Default mount path from TDD Deployment. */
export const DEFAULT_CONFIG_PATH = '/config/dashboard.yaml';

export type ConfigIssue = {
  path: string;
  message: string;
};

/** Config after schema defaults and service group inheritance are applied. */
export type ResolvedServiceConfig = Omit<ServiceConfig, 'groups'> & {
  groups: string[];
};

export type ResolvedApplicationConfig = Omit<ApplicationConfig, 'services'> & {
  services: ResolvedServiceConfig[];
};

export type ResolvedConfig = Omit<Config, 'applications'> & {
  applications: ResolvedApplicationConfig[];
};

export type ConfigLogger = {
  warn: (message: string) => void;
  error: (message: string) => void;
};

const defaultLogger: ConfigLogger = {
  warn: (message) => console.warn(message),
  error: (message) => console.error(message),
};

export class ConfigLoadError extends Error {
  readonly issues: ConfigIssue[];

  constructor(issues: ConfigIssue[]) {
    const summary = issues.map((i) => `${i.path}: ${i.message}`).join('; ');
    super(`Invalid configuration: ${summary}`);
    this.name = 'ConfigLoadError';
    this.issues = issues;
  }
}

const ROOT_KEYS = new Set(['adminGroup', 'groups', 'applications']);
const APPLICATION_KEYS = new Set([
  'id',
  'name',
  'description',
  'url',
  'icon',
  'groups',
  'requestable',
  'services',
]);
const SERVICE_KEYS = new Set(['id', 'name', 'containers', 'groups']);

let loadedConfig: ResolvedConfig | undefined;

export function resolveConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  return env.CONFIG_PATH ?? DEFAULT_CONFIG_PATH;
}

/** Frozen in-memory config from the last successful load. */
export function getConfig(): ResolvedConfig {
  if (loadedConfig === undefined) {
    throw new Error('Configuration has not been loaded');
  }
  return loadedConfig;
}

/** Test helper: clear the cached config so a failed load leaves no partial value. */
export function resetConfigForTests(): void {
  loadedConfig = undefined;
}

/**
 * Read, parse, validate, and freeze the config at `path` (or CONFIG_PATH).
 * On success, stores the result for {@link getConfig}. On failure, leaves
 * the accessor unset and throws {@link ConfigLoadError}.
 */
export function loadConfig(
  path: string = resolveConfigPath(),
  logger: ConfigLogger = defaultLogger,
): ResolvedConfig {
  loadedConfig = undefined;

  const issues: ConfigIssue[] = [];
  let rawText: string;

  try {
    rawText = readFileSync(path, 'utf8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ConfigLoadError([{ path: path, message: `cannot read config file: ${message}` }]);
  }

  let raw: unknown;
  try {
    raw = parseYaml(rawText);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ConfigLoadError([{ path: path, message: `unparseable YAML: ${message}` }]);
  }

  warnUnknownKeys(raw, logger);

  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    issues.push(
      ...parsed.error.issues.map((issue) => ({
        path: formatZodPath(issue.path),
        message: issue.message,
      })),
    );
  }
  issues.push(...danglingGroupIssues(raw));

  if (!parsed.success || issues.length > 0) {
    throw new ConfigLoadError(issues);
  }

  const resolved = applyDefaults(parsed.data);
  loadedConfig = deepFreeze(resolved);
  return loadedConfig;
}

/**
 * Load config or log every issue and exit non-zero.
 * Intended for process startup before the HTTP listener binds.
 */
export function loadConfigOrExit(
  path: string = resolveConfigPath(),
  logger: ConfigLogger = defaultLogger,
  exit: (code: number) => never = (code) => process.exit(code) as never,
): ResolvedConfig {
  try {
    return loadConfig(path, logger);
  } catch (err) {
    if (err instanceof ConfigLoadError) {
      for (const issue of err.issues) {
        logger.error(`config: ${issue.path}: ${issue.message}`);
      }
    } else {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`config: ${message}`);
    }
    exit(1);
  }
}

function applyDefaults(parsed: Config): ResolvedConfig {
  return {
    adminGroup: parsed.adminGroup,
    groups: parsed.groups,
    applications: parsed.applications.map((app) => ({
      ...app,
      services: app.services.map((service): ResolvedServiceConfig => ({
        id: service.id,
        name: service.name,
        containers: service.containers,
        groups: service.groups !== undefined ? service.groups : [...app.groups],
      })),
    })),
  };
}

function formatZodPath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return '(root)';
  }
  let out = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      out += `[${segment}]`;
    } else if (out.length === 0) {
      out = String(segment);
    } else {
      out += `.${String(segment)}`;
    }
  }
  return out;
}

function danglingGroupIssues(raw: unknown): ConfigIssue[] {
  if (!isPlainObject(raw) || !Array.isArray(raw.groups) || !Array.isArray(raw.applications)) {
    return [];
  }

  const declared = new Set(
    raw.groups.filter((group): group is string => typeof group === 'string'),
  );
  const issues: ConfigIssue[] = [];

  raw.applications.forEach((app, appIndex) => {
    if (!isPlainObject(app)) {
      return;
    }
    const appLabel = typeof app.id === 'string' ? app.id : `applications[${appIndex}]`;

    if (Array.isArray(app.groups)) {
      for (const group of app.groups) {
        if (typeof group === 'string' && !declared.has(group)) {
          issues.push({
            path: `applications[${appIndex}].groups`,
            message: `group "${group}" referenced by application "${appLabel}" is not in the top-level groups list`,
          });
        }
      }
    }

    if (!Array.isArray(app.services)) {
      return;
    }

    app.services.forEach((service, serviceIndex) => {
      if (!isPlainObject(service) || !Array.isArray(service.groups)) {
        return;
      }
      const serviceLabel =
        typeof service.id === 'string' ? service.id : `services[${serviceIndex}]`;
      for (const group of service.groups) {
        if (typeof group === 'string' && !declared.has(group)) {
          issues.push({
            path: `applications[${appIndex}].services[${serviceIndex}].groups`,
            message: `group "${group}" referenced by service "${serviceLabel}" of application "${appLabel}" is not in the top-level groups list`,
          });
        }
      }
    });
  });

  return issues;
}

function warnUnknownKeys(raw: unknown, logger: ConfigLogger): void {
  if (!isPlainObject(raw)) {
    return;
  }

  for (const key of Object.keys(raw)) {
    if (!ROOT_KEYS.has(key)) {
      logger.warn(`config: unrecognized key "${key}"`);
    }
  }

  if (!Array.isArray(raw.applications)) {
    return;
  }

  raw.applications.forEach((app, appIndex) => {
    if (!isPlainObject(app)) {
      return;
    }
    for (const key of Object.keys(app)) {
      if (!APPLICATION_KEYS.has(key)) {
        logger.warn(`config: unrecognized key "${key}" at applications[${appIndex}]`);
      }
    }
    if (!Array.isArray(app.services)) {
      return;
    }
    app.services.forEach((service, serviceIndex) => {
      if (!isPlainObject(service)) {
        return;
      }
      for (const key of Object.keys(service)) {
        if (!SERVICE_KEYS.has(key)) {
          logger.warn(
            `config: unrecognized key "${key}" at applications[${appIndex}].services[${serviceIndex}]`,
          );
        }
      }
    });
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return value;
}
