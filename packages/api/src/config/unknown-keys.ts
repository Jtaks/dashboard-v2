import {
  APPLICATION_CONFIG_KEYS,
  SERVICE_CONFIG_KEYS,
  TOP_LEVEL_CONFIG_KEYS,
} from '@dashboard/shared';

const TOP_LEVEL_KEYS = new Set<string>(TOP_LEVEL_CONFIG_KEYS);
const APPLICATION_KEYS = new Set<string>(APPLICATION_CONFIG_KEYS);
const SERVICE_KEYS = new Set<string>(SERVICE_CONFIG_KEYS);

function stripRecord(
  value: unknown,
  allowedKeys: Set<string>,
  path: string,
  unknownKeys: string[],
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Expected object at ${path}`);
  }

  const result: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value)) {
    const keyPath = path ? `${path}.${key}` : key;

    if (!allowedKeys.has(key)) {
      unknownKeys.push(keyPath);
      continue;
    }

    result[key] = child;
  }

  return result;
}

function stripService(value: unknown, path: string, unknownKeys: string[]): unknown {
  return stripRecord(value, SERVICE_KEYS, path, unknownKeys);
}

function stripApplication(value: unknown, path: string, unknownKeys: string[]): unknown {
  const stripped = stripRecord(value, APPLICATION_KEYS, path, unknownKeys);

  if (Array.isArray(stripped.services)) {
    stripped.services = stripped.services.map((service, index) =>
      stripService(service, `${path}.services.${index}`, unknownKeys),
    );
  }

  return stripped;
}

export function stripUnknownKeys(value: unknown): {
  value: unknown;
  unknownKeys: string[];
} {
  const unknownKeys: string[] = [];

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { value, unknownKeys };
  }

  const stripped = stripRecord(value, TOP_LEVEL_KEYS, '', unknownKeys);

  if (Array.isArray(stripped.applications)) {
    stripped.applications = stripped.applications.map((application, index) =>
      stripApplication(application, `applications.${index}`, unknownKeys),
    );
  }

  return { value: stripped, unknownKeys };
}
