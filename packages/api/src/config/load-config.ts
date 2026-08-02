import { readFileSync } from 'node:fs';

import {
  dashboardConfigSchema,
  type ApplicationConfig,
  type DashboardConfig,
  type ServiceConfig,
} from '@dashboard/shared';
import { parse as parseYaml } from 'yaml';

import { DEFAULT_CONFIG_PATH } from './constants.js';
import { stripUnknownKeys } from './unknown-keys.js';

export type ResolvedServiceConfig = Omit<ServiceConfig, 'groups'> & { groups: string[] };
export type ResolvedApplicationConfig = Omit<ApplicationConfig, 'services'> & {
  services: ResolvedServiceConfig[];
};
export type ResolvedDashboardConfig = Omit<DashboardConfig, 'applications'> & {
  applications: ResolvedApplicationConfig[];
};

export type ConfigIssue = {
  path: string;
  message: string;
};

export class ConfigLoadError extends Error {
  readonly issues: ConfigIssue[];

  constructor(message: string, issues: ConfigIssue[]) {
    super(message);
    this.name = 'ConfigLoadError';
    this.issues = issues;
  }
}

function formatZodPath(path: (string | number)[]): string {
  if (path.length === 0) {
    return '(root)';
  }

  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === 'number') {
      return `${formatted}.${segment}`;
    }

    return formatted ? `${formatted}.${segment}` : segment;
  }, '');
}

function applyServiceGroupInheritance(config: DashboardConfig): ResolvedDashboardConfig {
  return {
    ...config,
    applications: config.applications.map((application) => ({
      ...application,
      services: application.services.map((service) => ({
        ...service,
        groups: service.groups ?? application.groups,
      })),
    })),
  };
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}

function parseConfigDocument(raw: string, sourceLabel: string): ResolvedDashboardConfig {
  let parsed: unknown;

  try {
    parsed = parseYaml(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigLoadError(`Failed to parse config at ${sourceLabel}`, [
      { path: sourceLabel, message: `Invalid YAML: ${message}` },
    ]);
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ConfigLoadError(`Failed to parse config at ${sourceLabel}`, [
      { path: '(root)', message: 'Config root must be a YAML mapping' },
    ]);
  }

  const { value: stripped, unknownKeys } = stripUnknownKeys(parsed);

  for (const keyPath of unknownKeys) {
    console.warn(`Unrecognized config key "${keyPath}" ignored`);
  }

  const groupIssues = collectGroupReferenceIssues(stripped);
  const result = dashboardConfigSchema.safeParse(stripped);
  const schemaIssues = result.success
    ? []
    : result.error.issues.map((issue) => ({
        path: formatZodPath(issue.path),
        message: issue.message,
      }));
  const issues = dedupeIssues([...schemaIssues, ...groupIssues]);

  if (issues.length > 0) {
    throw new ConfigLoadError(`Config validation failed for ${sourceLabel}`, issues);
  }

  return applyServiceGroupInheritance(result.data!);
}

function dedupeIssues(issues: ConfigIssue[]): ConfigIssue[] {
  const seen = new Set<string>();

  return issues.filter((issue) => {
    const key = `${issue.path}|${issue.message}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function collectGroupReferenceIssues(value: unknown): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return issues;
  }

  const config = value as Record<string, unknown>;
  const knownGroups = new Set(
    Array.isArray(config.groups)
      ? config.groups.filter((group): group is string => typeof group === 'string')
      : [],
  );
  const applications = Array.isArray(config.applications) ? config.applications : [];

  for (const [appIndex, application] of applications.entries()) {
    if (typeof application !== 'object' || application === null) {
      continue;
    }

    const app = application as Record<string, unknown>;
    const appId = typeof app.id === 'string' ? app.id : String(appIndex);

    if (Array.isArray(app.groups)) {
      for (const group of app.groups) {
        if (typeof group === 'string' && !knownGroups.has(group)) {
          issues.push({
            path: `applications.${appIndex}.groups`,
            message: `Unknown group "${group}" referenced by application "${appId}"`,
          });
        }
      }
    }

    const services = Array.isArray(app.services) ? app.services : [];

    for (const [serviceIndex, service] of services.entries()) {
      if (typeof service !== 'object' || service === null) {
        continue;
      }

      const svc = service as Record<string, unknown>;
      const serviceId = typeof svc.id === 'string' ? svc.id : String(serviceIndex);

      if (!Array.isArray(svc.groups)) {
        continue;
      }

      for (const group of svc.groups) {
        if (typeof group === 'string' && !knownGroups.has(group)) {
          issues.push({
            path: `applications.${appIndex}.services.${serviceIndex}.groups`,
            message: `Unknown group "${group}" referenced by service "${serviceId}"`,
          });
        }
      }
    }
  }

  return issues;
}

export function loadConfigFromString(raw: string): ResolvedDashboardConfig {
  return parseConfigDocument(raw, '(string)');
}

export function loadConfigFromFile(configPath: string): ResolvedDashboardConfig {
  let raw: string;

  try {
    raw = readFileSync(configPath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigLoadError(`Failed to read config file at ${configPath}`, [
      { path: configPath, message },
    ]);
  }

  return parseConfigDocument(raw, configPath);
}

export function loadConfig(configPath: string = process.env.CONFIG_PATH ?? DEFAULT_CONFIG_PATH) {
  return loadConfigFromFile(configPath);
}

export function freezeConfig(config: ResolvedDashboardConfig): ResolvedDashboardConfig {
  return deepFreeze(structuredClone(config));
}

export function logConfigError(error: unknown): void {
  if (error instanceof ConfigLoadError) {
    console.error(error.message);
    for (const issue of error.issues) {
      console.error(`  ${issue.path}: ${issue.message}`);
    }
    return;
  }

  console.error(error);
}

export function loadConfigOrExit(
  configPath: string = process.env.CONFIG_PATH ?? DEFAULT_CONFIG_PATH,
): ResolvedDashboardConfig {
  try {
    return loadConfig(configPath);
  } catch (error) {
    logConfigError(error);
    process.exit(1);
    throw error;
  }
}
