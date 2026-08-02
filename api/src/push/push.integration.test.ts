import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import { loadConfig, resetConfigForTests, type ResolvedConfig } from '../config.js';
import { ensureDatabase, getDb, resetDatabaseForTests } from '../db/index.js';
import { ErrorCodes } from '../errors.js';
import type { RuntimeEnv } from '../env.js';
import { createLogger } from '../logging.js';
import {
  deleteSubscription,
  listAllEndpoints,
  listEndpointsByTopic,
  listEndpointsByTopics,
  listTopicsForEndpoint,
  rewriteTopics,
  upsertSubscription,
} from './repository.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

const TEST_PUBLIC_KEY =
  'BBvAqccKn9JVUDVBF0i4Xwvx0Rm39fzxQIgTZSl6-ItXsv4zaHoYOPKHeSd4mKBeojpKDB2Kgamft7UYb5SSoBs';
const TEST_PRIVATE_KEY = 'FBZCMHhGC9TyAgo48VhRHuYrJspA5qGscPALP6l1qSA';

const testEnv: RuntimeEnv = {
  port: 3000,
  logLevel: 'error',
  allowedOrigin: 'https://dashboard.example.com',
  autheliaLogoutUrl: 'https://auth.example.com/logout',
  dockerProxyUrl: undefined,
};

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dashboard-push-'));
  return join(dir, 'dashboard.db');
}

function cleanupDbPath(path: string): void {
  rmSync(dirname(path), { recursive: true, force: true });
}

function remoteHeaders(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    'Remote-User': 'alice',
    'Remote-Groups': 'media-users',
    'Remote-Email': 'alice@example.com',
    'Remote-Name': 'Alice Example',
    ...overrides,
  };
}

describe('push subscription repository', () => {
  let dbPath: string;

  beforeEach(() => {
    resetDatabaseForTests();
    dbPath = tempDbPath();
    ensureDatabase(dbPath);
  });

  afterEach(() => {
    resetDatabaseForTests();
    cleanupDbPath(dbPath);
  });

  it('upserts the same endpoint twice with one row, original created_at, later last_seen_at', () => {
    const db = getDb();
    const t1 = new Date('2026-03-01T10:00:00.000Z');
    const t2 = new Date('2026-03-01T11:00:00.000Z');

    const first = upsertSubscription(
      db,
      {
        endpoint: 'https://push.example/device-1',
        p256dh: 'p256dh-a',
        auth: 'auth-a',
        userId: 'alice',
      },
      () => t1,
    );

    const second = upsertSubscription(
      db,
      {
        endpoint: 'https://push.example/device-1',
        p256dh: 'p256dh-b',
        auth: 'auth-b',
        userId: 'bob',
      },
      () => t2,
    );

    expect(second.createdAt).toBe(first.createdAt);
    expect(second.createdAt).toBe('2026-03-01T10:00:00.000Z');
    expect(second.lastSeenAt).toBe('2026-03-01T11:00:00.000Z');
    expect(second.p256dh).toBe('p256dh-b');
    expect(second.auth).toBe('auth-b');
    expect(second.userId).toBe('bob');

    const count = (
      db.prepare(`SELECT COUNT(*) AS n FROM push_subscriptions`).get() as { n: number }
    ).n;
    expect(count).toBe(1);
  });

  it('rewrites topics to exactly the new set', () => {
    const db = getDb();
    upsertSubscription(db, {
      endpoint: 'https://push.example/device-1',
      p256dh: 'k',
      auth: 'a',
      userId: 'alice',
    });

    rewriteTopics(db, 'https://push.example/device-1', ['media-users', 'system-admins']);
    expect(listTopicsForEndpoint(db, 'https://push.example/device-1')).toEqual([
      'media-users',
      'system-admins',
    ]);

    rewriteTopics(db, 'https://push.example/device-1', ['media-users']);
    expect(listTopicsForEndpoint(db, 'https://push.example/device-1')).toEqual(['media-users']);
  });

  it('cascades topic rows when the subscription is deleted', () => {
    const db = getDb();
    upsertSubscription(db, {
      endpoint: 'https://push.example/device-1',
      p256dh: 'k',
      auth: 'a',
      userId: 'alice',
    });
    rewriteTopics(db, 'https://push.example/device-1', ['media-users', 'system-admins']);

    expect(deleteSubscription(db, 'https://push.example/device-1')).toBe(true);
    expect(
      (db.prepare(`SELECT COUNT(*) AS n FROM push_subscription_topics`).get() as { n: number }).n,
    ).toBe(0);
    expect(deleteSubscription(db, 'https://push.example/device-1')).toBe(false);
  });

  it('returns an endpoint once when two matching topics are queried', () => {
    const db = getDb();
    upsertSubscription(db, {
      endpoint: 'https://push.example/device-1',
      p256dh: 'k',
      auth: 'a',
      userId: 'alice',
    });
    rewriteTopics(db, 'https://push.example/device-1', ['media-users', 'system-admins']);

    const byBoth = listEndpointsByTopics(db, ['media-users', 'system-admins']);
    expect(byBoth).toHaveLength(1);
    expect(byBoth[0]?.endpoint).toBe('https://push.example/device-1');

    expect(listEndpointsByTopic(db, 'media-users')).toHaveLength(1);
  });

  it('listAllEndpoints returns every subscription for the * case', () => {
    const db = getDb();
    upsertSubscription(db, {
      endpoint: 'https://push.example/a',
      p256dh: 'k1',
      auth: 'a1',
      userId: 'alice',
    });
    upsertSubscription(db, {
      endpoint: 'https://push.example/b',
      p256dh: 'k2',
      auth: 'a2',
      userId: 'bob',
    });

    const all = listAllEndpoints(db);
    expect(all.map((r) => r.endpoint)).toEqual([
      'https://push.example/a',
      'https://push.example/b',
    ]);
  });
});

describe('GET /api/push/key', () => {
  let config: ResolvedConfig;
  let dbPath: string;

  beforeEach(() => {
    resetConfigForTests();
    resetDatabaseForTests();
    config = loadConfig(join(fixturesDir, 'valid.yaml'));
    dbPath = tempDbPath();
    ensureDatabase(dbPath);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    resetDatabaseForTests();
    cleanupDbPath(dbPath);
    resetConfigForTests();
    vi.restoreAllMocks();
  });

  function app() {
    return createApp({
      config,
      env: testEnv,
      logger: createLogger('error'),
      vapidPublicKey: TEST_PUBLIC_KEY,
    });
  }

  it('returns the public key for an authenticated user', async () => {
    const res = await app().request('/api/push/key', { headers: remoteHeaders() });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ publicKey: TEST_PUBLIC_KEY });
    expect(JSON.stringify(body)).not.toContain(TEST_PRIVATE_KEY);
  });

  it('answers 401 without identity headers', async () => {
    const res = await app().request('/api/push/key');

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: ErrorCodes.unauthorized });
  });

  it('never logs the private key when serving the public key', async () => {
    const errorSpy = vi.mocked(console.error);
    const logSpy = vi.mocked(console.log);
    const warnSpy = vi.mocked(console.warn);

    await app().request('/api/push/key', { headers: remoteHeaders() });

    const all = [...errorSpy.mock.calls, ...logSpy.mock.calls, ...warnSpy.mock.calls]
      .flat()
      .map(String)
      .join('\n');
    expect(all).not.toContain(TEST_PRIVATE_KEY);
  });
});
