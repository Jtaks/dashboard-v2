import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import { initConfig, resetConfigForTesting } from '../config/get-config.js';
import { openDatabase, resetDatabaseForTesting } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { createPushSubscriptionsRepository } from '../push/push-subscriptions-repository.js';
import { TEST_VAPID_PUBLIC_KEY } from '../test-helpers/constants.js';

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

const ENDPOINT = 'https://push.example/subscription/1';

const subscriptionBody = {
  endpoint: ENDPOINT,
  keys: {
    p256dh: 'p256dh-key',
    auth: 'auth-key',
  },
};

const multiGroupUser = {
  user: 'alice',
  groups: ['media-users', 'system-admins'],
  email: 'alice@example.com',
  name: 'Alice',
};

const singleGroupUser = {
  user: 'alice',
  groups: ['media-users'],
  email: 'alice@example.com',
  name: 'Alice',
};

const otherUser = {
  user: 'bob',
  groups: ['media-admins'],
  email: 'bob@example.com',
  name: 'Bob',
};

let tempDirectory: string | null = null;

function headersForUser(
  user: { user: string; groups: string[]; email: string; name: string } | null,
  options: { origin?: string; contentType?: string } = {},
): HeadersInit {
  if (!user) {
    return {
      Accept: 'application/json',
      ...(options.contentType ? { 'Content-Type': options.contentType } : {}),
      ...(options.origin ? { Origin: options.origin } : {}),
    };
  }

  return {
    Accept: 'application/json',
    'Remote-User': user.user,
    'Remote-Groups': user.groups.join(','),
    'Remote-Email': user.email,
    'Remote-Name': user.name,
    ...(options.origin ? { Origin: options.origin } : {}),
    ...(options.contentType ? { 'Content-Type': options.contentType } : {}),
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

async function setupEnvironment() {
  resetConfigForTesting();
  resetDatabaseForTesting();

  tempDirectory = mkdtempSync(join(tmpdir(), 'dashboard-push-subscriptions-'));
  const configPath = join(tempDirectory, 'dashboard.yaml');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(configPath, PUSH_CONFIG, 'utf8');

  initConfig(configPath);
  const db = openDatabase(join(tempDirectory, 'dashboard.db'));
  runMigrations(db);

  return { app: createTestApp(), db };
}

afterEach(() => {
  resetConfigForTesting();
  resetDatabaseForTesting();
  if (tempDirectory) {
    rmSync(tempDirectory, { recursive: true, force: true });
    tempDirectory = null;
  }
});

describe('POST /api/push/subscriptions', () => {
  it('upserts once and advances last_seen_at without changing created_at', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const { app, db } = await setupEnvironment();

    const first = await app.request('/api/push/subscriptions', {
      method: 'POST',
      headers: headersForUser(singleGroupUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify(subscriptionBody),
    });
    expect(first.status).toBe(204);

    const rowAfterFirst = db
      .prepare('SELECT created_at, last_seen_at FROM push_subscriptions WHERE endpoint = ?')
      .get(ENDPOINT) as { created_at: string; last_seen_at: string };
    expect(rowAfterFirst.created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(rowAfterFirst.last_seen_at).toBe('2026-01-01T00:00:00.000Z');

    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));

    const second = await app.request('/api/push/subscriptions', {
      method: 'POST',
      headers: headersForUser(singleGroupUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({
        ...subscriptionBody,
        keys: { p256dh: 'p256dh-updated', auth: 'auth-updated' },
      }),
    });
    expect(second.status).toBe(204);

    const rowAfterSecond = db
      .prepare(
        'SELECT created_at, last_seen_at, p256dh FROM push_subscriptions WHERE endpoint = ?',
      )
      .get(ENDPOINT) as { created_at: string; last_seen_at: string; p256dh: string };
    expect(rowAfterSecond.created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(rowAfterSecond.last_seen_at).toBe('2026-01-02T00:00:00.000Z');
    expect(rowAfterSecond.p256dh).toBe('p256dh-updated');

    const count = db.prepare('SELECT COUNT(*) as count FROM push_subscriptions').get() as {
      count: number;
    };
    expect(count.count).toBe(1);

    vi.useRealTimers();
  });

  it('writes topics from Remote-Groups on upsert', async () => {
    const { app, db } = await setupEnvironment();
    const repository = createPushSubscriptionsRepository(db);

    const response = await app.request('/api/push/subscriptions', {
      method: 'POST',
      headers: headersForUser(multiGroupUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify(subscriptionBody),
    });
    expect(response.status).toBe(204);

    expect(repository.listTopics(ENDPOINT)).toEqual(['media-users', 'system-admins']);
  });

  it('rewrites topics when Remote-Groups shrink on a later upsert', async () => {
    const { app, db } = await setupEnvironment();
    const repository = createPushSubscriptionsRepository(db);

    await app.request('/api/push/subscriptions', {
      method: 'POST',
      headers: headersForUser(multiGroupUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify(subscriptionBody),
    });

    await app.request('/api/push/subscriptions', {
      method: 'POST',
      headers: headersForUser(singleGroupUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify(subscriptionBody),
    });

    expect(repository.listTopics(ENDPOINT)).toEqual(['media-users']);
  });

  it('reassigns user_id and topics when the endpoint is posted under a different user', async () => {
    const { app, db } = await setupEnvironment();
    const repository = createPushSubscriptionsRepository(db);

    await app.request('/api/push/subscriptions', {
      method: 'POST',
      headers: headersForUser(singleGroupUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify(subscriptionBody),
    });

    await app.request('/api/push/subscriptions', {
      method: 'POST',
      headers: headersForUser(otherUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify(subscriptionBody),
    });

    const row = db
      .prepare('SELECT user_id FROM push_subscriptions WHERE endpoint = ?')
      .get(ENDPOINT) as { user_id: string };
    expect(row.user_id).toBe('bob');
    expect(repository.listTopics(ENDPOINT)).toEqual(['media-admins']);
  });

  it('returns 401 without identity headers', async () => {
    const { app } = await setupEnvironment();

    const response = await app.request('/api/push/subscriptions', {
      method: 'POST',
      headers: headersForUser(null, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify(subscriptionBody),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: 'unauthorized' });
  });

  it('refuses a foreign Origin', async () => {
    const { app, db } = await setupEnvironment();

    const response = await app.request('/api/push/subscriptions', {
      method: 'POST',
      headers: headersForUser(singleGroupUser, {
        origin: 'https://evil.example.com',
        contentType: 'application/json',
      }),
      body: JSON.stringify(subscriptionBody),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: 'origin_mismatch' });

    const count = db.prepare('SELECT COUNT(*) as count FROM push_subscriptions').get() as {
      count: number;
    };
    expect(count.count).toBe(0);
  });

  it('rejects a body missing keys.auth without writing', async () => {
    const { app, db } = await setupEnvironment();

    const response = await app.request('/api/push/subscriptions', {
      method: 'POST',
      headers: headersForUser(singleGroupUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({
        endpoint: ENDPOINT,
        keys: { p256dh: 'p256dh-key' },
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: 'bad_request' });

    const count = db.prepare('SELECT COUNT(*) as count FROM push_subscriptions').get() as {
      count: number;
    };
    expect(count.count).toBe(0);
  });
});

describe('DELETE /api/push/subscriptions', () => {
  it('removes the subscription and its topics, and a second delete still succeeds', async () => {
    const { app, db } = await setupEnvironment();

    await app.request('/api/push/subscriptions', {
      method: 'POST',
      headers: headersForUser(singleGroupUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify(subscriptionBody),
    });

    const firstDelete = await app.request('/api/push/subscriptions', {
      method: 'DELETE',
      headers: headersForUser(singleGroupUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({ endpoint: ENDPOINT }),
    });
    expect(firstDelete.status).toBe(204);

    const subscriptionCount = db
      .prepare('SELECT COUNT(*) as count FROM push_subscriptions')
      .get() as { count: number };
    const topicCount = db
      .prepare('SELECT COUNT(*) as count FROM push_subscription_topics')
      .get() as { count: number };
    expect(subscriptionCount.count).toBe(0);
    expect(topicCount.count).toBe(0);

    const secondDelete = await app.request('/api/push/subscriptions', {
      method: 'DELETE',
      headers: headersForUser(singleGroupUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({ endpoint: ENDPOINT }),
    });
    expect(secondDelete.status).toBe(204);
  });

  it('returns 401 without identity headers', async () => {
    const { app } = await setupEnvironment();

    const response = await app.request('/api/push/subscriptions', {
      method: 'DELETE',
      headers: headersForUser(null, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({ endpoint: ENDPOINT }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: 'unauthorized' });
  });

  it('refuses a foreign Origin', async () => {
    const { app, db } = await setupEnvironment();

    await app.request('/api/push/subscriptions', {
      method: 'POST',
      headers: headersForUser(singleGroupUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify(subscriptionBody),
    });

    const response = await app.request('/api/push/subscriptions', {
      method: 'DELETE',
      headers: headersForUser(singleGroupUser, {
        origin: 'https://evil.example.com',
        contentType: 'application/json',
      }),
      body: JSON.stringify({ endpoint: ENDPOINT }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: 'origin_mismatch' });

    const count = db.prepare('SELECT COUNT(*) as count FROM push_subscriptions').get() as {
      count: number;
    };
    expect(count.count).toBe(1);
  });
});
