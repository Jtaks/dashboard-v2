import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initConfig, resetConfigForTesting } from '../config/get-config.js';
import { openDatabase, resetDatabaseForTesting } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { createPushSubscriptionsRepository } from '../push/push-subscriptions-repository.js';
import { TEST_VAPID_PUBLIC_KEY } from '../test-helpers/constants.js';

const sendNotification = vi.hoisted(() => vi.fn());

vi.mock('web-push', () => ({
  default: {
    sendNotification,
    setVapidDetails: vi.fn(),
  },
}));

import webpush from 'web-push';

import { createApp } from '../app.js';

const PUSH_CONFIG = `
adminGroup: system-admins
groups:
  - media-users
  - media-admins
applications:
  - id: media
    name: Media
    description: Films and series.
    url: https://media.example.com
    icon: media.svg
    groups: [media-users]
    services: []
`;

const ALLOWED_ORIGIN = 'https://dashboard.example.com';
const LOGOUT_URL = 'https://auth.example.com/logout';
const DOCKER_PROXY_URL = 'http://docker-proxy.example.com';

const adminUser = {
  user: 'admin',
  groups: ['system-admins', 'media-admins'],
  email: 'admin@example.com',
  name: 'Admin',
};

const regularUser = {
  user: 'alice',
  groups: ['media-users'],
  email: 'alice@example.com',
  name: 'Alice',
};

let tempDirectory: string | null = null;

function headersForUser(
  user: { user: string; groups: string[]; email: string; name: string } | null,
  options: { origin?: string } = {},
): HeadersInit {
  if (!user) {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.origin ? { Origin: options.origin } : {}),
    };
  }

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Remote-User': user.user,
    'Remote-Groups': user.groups.join(','),
    'Remote-Email': user.email,
    'Remote-Name': user.name,
    ...(options.origin ? { Origin: options.origin } : {}),
  };
}

function createTestApp() {
  return createApp({
    allowedOrigin: ALLOWED_ORIGIN,
    autheliaLogoutUrl: LOGOUT_URL,
    dockerProxyUrl: DOCKER_PROXY_URL,
    vapidPublicKey: TEST_VAPID_PUBLIC_KEY,
  });
}

function seedSubscription(
  endpoint: string,
  topics: string[],
  repository = createPushSubscriptionsRepository(openDatabase(join(tempDirectory!, 'dashboard.db'))),
) {
  repository.upsert({
    endpoint,
    p256dh: `p256dh-${endpoint}`,
    auth: `auth-${endpoint}`,
    userId: 'alice',
  });
  repository.rewriteTopics(endpoint, topics);
}

beforeEach(() => {
  resetConfigForTesting();
  resetDatabaseForTesting();
  vi.mocked(webpush.sendNotification).mockReset();

  tempDirectory = mkdtempSync(join(tmpdir(), 'dashboard-admin-push-'));
  const configPath = join(tempDirectory, 'dashboard.yaml');
  writeFileSync(configPath, PUSH_CONFIG, 'utf8');

  initConfig(configPath);
  const db = openDatabase(join(tempDirectory, 'dashboard.db'));
  runMigrations(db);
});

afterEach(() => {
  resetConfigForTesting();
  resetDatabaseForTesting();
  if (tempDirectory) {
    rmSync(tempDirectory, { recursive: true, force: true });
    tempDirectory = null;
  }
});

describe('admin push API', () => {
  it('returns 401 for unauthenticated requests', async () => {
    const app = createTestApp();

    const response = await app.request('/api/admin/push', {
      method: 'POST',
      headers: headersForUser(null, { origin: ALLOWED_ORIGIN }),
      body: JSON.stringify({
        title: 'Title',
        body: 'Body',
        url: null,
        topic: '*',
      }),
    });

    expect(response.status).toBe(401);
    expect(vi.mocked(webpush.sendNotification)).not.toHaveBeenCalled();
  });

  it('returns 403 for authenticated non-admin users', async () => {
    const app = createTestApp();

    const response = await app.request('/api/admin/push', {
      method: 'POST',
      headers: headersForUser(regularUser, { origin: ALLOWED_ORIGIN }),
      body: JSON.stringify({
        title: 'Title',
        body: 'Body',
        url: null,
        topic: '*',
      }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: 'forbidden' });
    expect(vi.mocked(webpush.sendNotification)).not.toHaveBeenCalled();
  });

  it('returns attempted and failed counts across success, 404, 410, and 500', async () => {
    const app = createTestApp();
    seedSubscription('https://push.example/ok', ['media-users']);
    seedSubscription('https://push.example/gone', ['media-users']);
    seedSubscription('https://push.example/expired', ['media-users']);
    seedSubscription('https://push.example/retry', ['media-users']);

    vi.mocked(webpush.sendNotification).mockImplementation(async (subscription) => {
      if (subscription.endpoint === 'https://push.example/gone') {
        throw { statusCode: 404 };
      }

      if (subscription.endpoint === 'https://push.example/expired') {
        throw { statusCode: 410 };
      }

      if (subscription.endpoint === 'https://push.example/retry') {
        throw { statusCode: 500 };
      }

      return {} as never;
    });

    const response = await app.request('/api/admin/push', {
      method: 'POST',
      headers: headersForUser(adminUser, { origin: ALLOWED_ORIGIN }),
      body: JSON.stringify({
        title: 'Maintenance',
        body: 'Expect downtime.',
        url: 'https://dashboard.example.com',
        topic: 'media-users',
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ attempted: 4, failed: 3 });

    const repository = createPushSubscriptionsRepository(
      openDatabase(join(tempDirectory!, 'dashboard.db')),
    );
    expect(repository.getByEndpoint('https://push.example/ok')).not.toBeNull();
    expect(repository.getByEndpoint('https://push.example/gone')).toBeNull();
    expect(repository.getByEndpoint('https://push.example/expired')).toBeNull();
    expect(repository.getByEndpoint('https://push.example/retry')).not.toBeNull();
    expect(vi.mocked(webpush.sendNotification)).toHaveBeenCalledTimes(4);
  });

  it('reaches every subscription for the wildcard topic', async () => {
    const app = createTestApp();
    seedSubscription('https://push.example/1', ['media-users']);
    seedSubscription('https://push.example/2', ['media-admins']);

    vi.mocked(webpush.sendNotification).mockResolvedValue({} as never);

    const response = await app.request('/api/admin/push', {
      method: 'POST',
      headers: headersForUser(adminUser, { origin: ALLOWED_ORIGIN }),
      body: JSON.stringify({
        title: 'Everyone',
        body: 'System-wide notice',
        url: null,
        topic: '*',
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ attempted: 2, failed: 0 });
    expect(vi.mocked(webpush.sendNotification)).toHaveBeenCalledTimes(2);
  });

  it('returns 400 for invalid payloads', async () => {
    const app = createTestApp();

    const response = await app.request('/api/admin/push', {
      method: 'POST',
      headers: headersForUser(adminUser, { origin: ALLOWED_ORIGIN }),
      body: JSON.stringify({
        title: '',
        body: 'Body',
        url: null,
        topic: 'media-users',
      }),
    });

    expect(response.status).toBe(400);
    expect(vi.mocked(webpush.sendNotification)).not.toHaveBeenCalled();
  });
});
