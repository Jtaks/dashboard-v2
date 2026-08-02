import webpush from 'web-push';

import {
  loadVapidKeys,
  logVapidError,
  type VapidKeys,
} from './load-vapid-keys.js';

export type PushConfig = {
  publicKey: string;
};

let cachedPushConfig: PushConfig | null = null;

function requireVapidSubject(subject: string | undefined): string {
  if (!subject || subject.trim().length === 0) {
    console.error('VAPID_SUBJECT is required');
    process.exit(1);
    throw new Error('VAPID_SUBJECT is required');
  }

  return subject;
}

function configureWebPush(keys: VapidKeys, subject: string): PushConfig {
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  return { publicKey: keys.publicKey };
}

export function initPush(options: {
  vapidKeysPath?: string;
  vapidSubject?: string;
} = {}): PushConfig {
  if (cachedPushConfig) {
    return cachedPushConfig;
  }

  const subject = requireVapidSubject(
    options.vapidSubject ?? process.env.VAPID_SUBJECT,
  );

  try {
    const keys = loadVapidKeys(options.vapidKeysPath);
    cachedPushConfig = configureWebPush(keys, subject);
    return cachedPushConfig;
  } catch (error) {
    logVapidError(error);
    process.exit(1);
    throw error;
  }
}

export function getPushConfig(): PushConfig {
  if (!cachedPushConfig) {
    throw new Error('Push has not been initialized. Call initPush() at startup.');
  }

  return cachedPushConfig;
}

/** @internal */
export function resetPushForTesting(): void {
  cachedPushConfig = null;
}
