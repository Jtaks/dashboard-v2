import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import { initConfig, resetConfigForTesting } from '../config/get-config.js';
import { initPush, resetPushForTesting } from '../push/init-push.js';

const VALID_CONFIG = `
adminGroup: system-admins
groups:
  - media-users
applications:
  - id: media
    name: Media
    description: Films and series.
    url: https://media.example.com
    icon: media.svg
    groups: [media-users]
    services: []
`;

const VALID_VAPID_KEYS = {
  publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
  privateKey: 'UUxI4O8-FbRqjAkxvyJdrM5EHyCu7x96v0MOASq6Jgk',
};

const ALLOWED_ORIGIN = 'https://dashboard.example.com';
const LOGOUT_URL = 'https://auth.example.com/logout';
const DOCKER_PROXY_URL = 'http://docker-proxy.example.com';
const VAPID_SUBJECT = 'mailto:admin@example.com';

const regularUser = {
  user: 'alice',
  groups: ['media-users'],
  email: 'alice@example.com',
  name: 'Alice',
};

let tempDirectory: string | null = null;

function headersForUser(
  user: { user: string; groups: string[]; email: string; name: string } | null,
): HeadersInit {
  if (!user) {
    return { Accept: 'application/json' };
  }

  return {
    Accept: 'application/json',
    'Remote-User': user.user,
    'Remote-Groups': user.groups.join(','),
    'Remote-Email': user.email,
    'Remote-Name': user.name,
  };
}

function setupEnvironment() {
  resetConfigForTesting();
  resetPushForTesting();

  tempDirectory = mkdtempSync(join(tmpdir(), 'dashboard-push-key-'));
  const configPath = join(tempDirectory, 'dashboard.yaml');
  const vapidKeysPath = join(tempDirectory, 'vapid.json');
  writeFileSync(configPath, VALID_CONFIG, 'utf8');
  writeFileSync(vapidKeysPath, JSON.stringify(VALID_VAPID_KEYS), 'utf8');

  initConfig(configPath);
  const pushConfig = initPush({
    vapidKeysPath,
    vapidSubject: VAPID_SUBJECT,
  });

  const app = createApp({
    allowedOrigin: ALLOWED_ORIGIN,
    autheliaLogoutUrl: LOGOUT_URL,
    dockerProxyUrl: DOCKER_PROXY_URL,
    vapidPublicKey: pushConfig.publicKey,
  });

  return { app, vapidKeysPath };
}

afterEach(() => {
  resetConfigForTesting();
  resetPushForTesting();
  if (tempDirectory) {
    rmSync(tempDirectory, { recursive: true, force: true });
    tempDirectory = null;
  }
});

describe('GET /api/push/key', () => {
  it('returns the configured public key for authenticated users', async () => {
    const { app } = setupEnvironment();

    const response = await app.request('/api/push/key', {
      headers: headersForUser(regularUser),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ publicKey: VALID_VAPID_KEYS.publicKey });
  });

  it('returns 401 without identity headers', async () => {
    const { app } = setupEnvironment();

    const response = await app.request('/api/push/key', {
      headers: headersForUser(null),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: 'unauthorized' });
  });

  it('never exposes the private key in the response', async () => {
    const { app } = setupEnvironment();

    const response = await app.request('/api/push/key', {
      headers: headersForUser(regularUser),
    });
    const body = JSON.stringify(await response.json());

    expect(body).not.toContain(VALID_VAPID_KEYS.privateKey);
    expect(body).not.toContain('privateKey');
  });
});

describe('initPush startup', () => {
  it('exits non-zero when VAPID_SUBJECT is missing', () => {
    resetPushForTesting();
    tempDirectory = mkdtempSync(join(tmpdir(), 'dashboard-push-startup-'));
    const vapidKeysPath = join(tempDirectory, 'vapid.json');
    writeFileSync(vapidKeysPath, JSON.stringify(VALID_VAPID_KEYS), 'utf8');

    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as typeof process.exit);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => initPush({ vapidKeysPath, vapidSubject: '' })).toThrow('process.exit');
    expect(exit).toHaveBeenCalledWith(1);
    expect(errorLog).toHaveBeenCalledWith('VAPID_SUBJECT is required');
  });

  it('exits non-zero when the keys file is missing', () => {
    resetPushForTesting();

    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as typeof process.exit);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      initPush({
        vapidKeysPath: join(tmpdir(), 'missing-vapid.json'),
        vapidSubject: VAPID_SUBJECT,
      }),
    ).toThrow('process.exit');
    expect(exit).toHaveBeenCalledWith(1);
    expect(errorLog).toHaveBeenCalled();
  });
});
