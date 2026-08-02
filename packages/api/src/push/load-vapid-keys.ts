import { readFileSync } from 'node:fs';

import { z } from 'zod';

export const DEFAULT_VAPID_KEYS_PATH = '/config/vapid.json';

const vapidKeysSchema = z.object({
  publicKey: z.string().min(1),
  privateKey: z.string().min(1),
});

export type VapidKeys = z.infer<typeof vapidKeysSchema>;

export type VapidIssue = {
  path: string;
  message: string;
};

export class VapidLoadError extends Error {
  readonly issues: VapidIssue[];

  constructor(message: string, issues: VapidIssue[]) {
    super(message);
    this.name = 'VapidLoadError';
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

function parseVapidDocument(raw: string, sourceLabel: string): VapidKeys {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new VapidLoadError(`Failed to parse VAPID keys at ${sourceLabel}`, [
      { path: sourceLabel, message: `Invalid JSON: ${message}` },
    ]);
  }

  const result = vapidKeysSchema.safeParse(parsed);
  if (!result.success) {
    throw new VapidLoadError(`VAPID keys validation failed for ${sourceLabel}`, result.error.issues.map(
      (issue) => ({
        path: formatZodPath(issue.path),
        message: issue.message,
      }),
    ));
  }

  return result.data;
}

export function loadVapidKeysFromString(raw: string): VapidKeys {
  return parseVapidDocument(raw, '(string)');
}

export function loadVapidKeysFromFile(keysPath: string): VapidKeys {
  let raw: string;

  try {
    raw = readFileSync(keysPath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new VapidLoadError(`Failed to read VAPID keys file at ${keysPath}`, [
      { path: keysPath, message },
    ]);
  }

  return parseVapidDocument(raw, keysPath);
}

export function loadVapidKeys(
  keysPath: string = process.env.VAPID_KEYS_PATH ?? DEFAULT_VAPID_KEYS_PATH,
): VapidKeys {
  return loadVapidKeysFromFile(keysPath);
}

export function logVapidError(error: unknown): void {
  if (error instanceof VapidLoadError) {
    console.error(error.message);
    for (const issue of error.issues) {
      console.error(`  ${issue.path}: ${issue.message}`);
    }
    return;
  }

  console.error(error);
}

export function loadVapidKeysOrExit(
  keysPath: string = process.env.VAPID_KEYS_PATH ?? DEFAULT_VAPID_KEYS_PATH,
): VapidKeys {
  try {
    return loadVapidKeys(keysPath);
  } catch (error) {
    logVapidError(error);
    process.exit(1);
    throw error;
  }
}
