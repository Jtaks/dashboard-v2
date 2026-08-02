import { readFileSync } from 'node:fs';
import webpush from 'web-push';
import { z } from 'zod';

/** Default mount path from TDD Deployment. */
export const DEFAULT_VAPID_KEYS_PATH = '/config/vapid.json';

export type VapidKeys = {
  publicKey: string;
  privateKey: string;
};

export type VapidConfig = VapidKeys & {
  subject: string;
};

export type VapidIssue = {
  path: string;
  message: string;
};

export type VapidLogger = {
  error: (message: string) => void;
};

const defaultLogger: VapidLogger = {
  error: (message) => console.error(message),
};

const vapidKeysSchema = z.object({
  publicKey: z.string().min(1),
  privateKey: z.string().min(1),
});

let loaded: VapidConfig | undefined;

export class VapidLoadError extends Error {
  readonly issues: VapidIssue[];

  constructor(issues: VapidIssue[]) {
    const summary = issues.map((i) => `${i.path}: ${i.message}`).join('; ');
    super(`Invalid VAPID configuration: ${summary}`);
    this.name = 'VapidLoadError';
    this.issues = issues;
  }
}

export function resolveVapidKeysPath(env: NodeJS.ProcessEnv = process.env): string {
  return env.VAPID_KEYS_PATH ?? DEFAULT_VAPID_KEYS_PATH;
}

/** Public key from the last successful {@link ensureVapid}. Never exposes the private key. */
export function getVapidPublicKey(): string {
  if (loaded === undefined) {
    throw new Error('VAPID has not been configured');
  }
  return loaded.publicKey;
}

/** Full config from the last successful load (for dispatch). Callers must not log privateKey. */
export function getVapidConfig(): VapidConfig {
  if (loaded === undefined) {
    throw new Error('VAPID has not been configured');
  }
  return loaded;
}

/** Test helper: clear cached VAPID so a failed load leaves no partial value. */
export function resetVapidForTests(): void {
  loaded = undefined;
}

/**
 * Read and zod-validate `{ publicKey, privateKey }` at `path`.
 * Does not configure web-push and does not read VAPID_SUBJECT.
 */
export function loadVapidKeys(path: string = resolveVapidKeysPath()): VapidKeys {
  let rawText: string;
  try {
    rawText = readFileSync(path, 'utf8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new VapidLoadError([
      { path: 'VAPID_KEYS_PATH', message: `cannot read keys file at ${path}: ${message}` },
    ]);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawText) as unknown;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new VapidLoadError([
      { path: 'VAPID_KEYS_PATH', message: `unparseable JSON at ${path}: ${message}` },
    ]);
  }

  const parsed = vapidKeysSchema.safeParse(raw);
  if (!parsed.success) {
    throw new VapidLoadError(
      parsed.error.issues.map((issue) => ({
        path: formatZodPath(issue.path),
        message: issue.message,
      })),
    );
  }

  return parsed.data;
}

/** Read required VAPID_SUBJECT (`mailto:` or `https:` contact). */
export function loadVapidSubject(env: NodeJS.ProcessEnv = process.env): string {
  const subject = env.VAPID_SUBJECT?.trim();
  if (!subject) {
    throw new VapidLoadError([{ path: 'VAPID_SUBJECT', message: 'VAPID_SUBJECT is required' }]);
  }
  return subject;
}

/**
 * Configure `web-push` once with the subject and key pair.
 * The private key is passed only to web-push and is never logged.
 */
export function configureWebPush(config: VapidConfig): void {
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
}

/**
 * Load keys + subject, configure web-push, and retain the result for {@link getVapidPublicKey}.
 * On failure, leaves the accessor unset and throws {@link VapidLoadError}.
 */
export function ensureVapid(
  path: string = resolveVapidKeysPath(),
  env: NodeJS.ProcessEnv = process.env,
): VapidConfig {
  loaded = undefined;

  const keys = loadVapidKeys(path);
  const subject = loadVapidSubject(env);
  const config: VapidConfig = { ...keys, subject };
  configureWebPush(config);
  loaded = config;
  return loaded;
}

/**
 * Ensure VAPID or log every issue and exit non-zero.
 * Intended for process startup before the HTTP listener binds.
 * Log lines name the faulty field/path and never include the private key.
 */
export function ensureVapidOrExit(
  path?: string,
  env: NodeJS.ProcessEnv = process.env,
  logger: VapidLogger = defaultLogger,
  exit: (code: number) => never = (code) => process.exit(code) as never,
): VapidConfig {
  try {
    return ensureVapid(path ?? resolveVapidKeysPath(env), env);
  } catch (err) {
    if (err instanceof VapidLoadError) {
      for (const issue of err.issues) {
        logger.error(`vapid: ${issue.path}: ${issue.message}`);
      }
    } else {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`vapid: ${message}`);
    }
    exit(1);
  }
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
