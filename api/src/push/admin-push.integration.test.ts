import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PushResult, PushSend } from '@dashboard/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import { loadConfig, resetConfigForTests, type ResolvedConfig } from '../config.js';
import { ensureDatabase, getDb, resetDatabaseForTests } from '../db/index.js';
import { ErrorCodes } from '../errors.js';
import type { RuntimeEnv } from '../env.js';
import { createLogger } from '../logging.js';
import type { PushSender } from './dispatch.js';
import { rewriteTopics, upsertSubscription } from './repository.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

const testEnv: RuntimeEnv = {
  port: 3000,
  logLevel: 'error',
  allowedOrigin: 'https://dashboard.example.com',
  autheliaLogoutUrl: 'https://auth.example.com/logout',
  dockerProxyUrl: undefined,
};

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dashboard-admin-push-'));
  return join(dir, 'dashboard.db');
}

function cleanupDbPath(path: string): void {
  rmSync(dirname(path), { recursive: true, force: true });
}

function remoteHeaders(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    'Remote-User': 'alice',
    'Remote-Groups': 'system-admins',
    'Remote-Email': 'alice@example.com',
    'Remote-Name': 'Alice Example',
    ...overrides,
  };
}

function mutatingHeaders(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    ...remoteHeaders(overrides),
    Origin: testEnv.allowedOrigin,
    'Content-Type': 'application/json',
  };
}

function seedSubscription(
  endpoint: string,
  topics: readonly string[],
  keys = { p256dh: `p256dh-${endpoint}`, auth: `auth-${endpoint}` },
): void {
  const db = getDb();
  upsertSubscription(db, {
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    userId: 'bob',
  });
  rewriteTopics(db, endpoint, topics);
}

function webPushError(statusCode: number): Error & { statusCode: number } {
  const err = new Error(`push failed ${statusCode}`) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

describe('POST /api/admin/push', () => {
  let config: ResolvedConfig;
  let dbPath: string;
  let sendMock: ReturnType<typeof vi.fn<PushSender>>;

  beforeEach(() => {
    resetConfigForTests();
    resetDatabaseForTests();
    config = loadConfig(join(fixturesDir, 'valid.yaml'));
    dbPath = tempDbPath();
    ensureDatabase(dbPath);
    sendMock = vi.fn<PushSender>(async () => {});
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
      adminPush: { send: sendMock },
    });
  }

  async function postPush(body: unknown, headers: Record<string, string> = mutatingHeaders()) {
    return app().request('/api/admin/push', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  const sample: PushSend = {
    title: 'Secret title',
    body: 'Secret body',
    url: '/secret-url',
    topic: '*',
  };

  it('dispatches once per distinct endpoint; dual-topic endpoint counted once', async () => {
    seedSubscription('https://push.example/dual', ['media-users', 'media-admins']);
    seedSubscription('https://push.example/media', ['media-users']);
    seedSubscription('https://push.example/other', ['media-admins']);

    const res = await postPush({ ...sample, topic: 'media-users' });
    expect(res.status).toBe(200);
    const result = (await res.json()) as PushResult;
    expect(result).toEqual({ attempted: 2, failed: 0 });
    expect(sendMock).toHaveBeenCalledTimes(2);

    const endpoints = sendMock.mock.calls.map((c) => c[0].endpoint).sort();
    expect(endpoints).toEqual(['https://push.example/dual', 'https://push.example/media']);

    const payload = JSON.parse(sendMock.mock.calls[0]![1]!) as PushSend;
    expect(payload).toEqual({ ...sample, topic: 'media-users' });
  });

  it('topic * reaches every subscription', async () => {
    seedSubscription('https://push.example/a', ['media-users']);
    seedSubscription('https://push.example/b', ['media-admins']);

    const res = await postPush({ ...sample, topic: '*' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ attempted: 2, failed: 0 });
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('group topic reaches only endpoints carrying that topic', async () => {
    seedSubscription('https://push.example/a', ['media-users']);
    seedSubscription('https://push.example/b', ['media-admins']);

    const res = await postPush({ ...sample, topic: 'media-admins' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ attempted: 1, failed: 0 });
    expect(sendMock.mock.calls[0]![0].endpoint).toBe('https://push.example/b');
  });

  it('deletes and counts failed on 404 and 410; keeps row on 500', async () => {
    seedSubscription('https://push.example/gone-404', ['media-users']);
    seedSubscription('https://push.example/gone-410', ['media-users']);
    seedSubscription('https://push.example/transient', ['media-users']);
    seedSubscription('https://push.example/ok', ['media-users']);

    sendMock.mockImplementation(async (sub) => {
      if (sub.endpoint.endsWith('gone-404')) {
        throw webPushError(404);
      }
      if (sub.endpoint.endsWith('gone-410')) {
        throw webPushError(410);
      }
      if (sub.endpoint.endsWith('transient')) {
        throw webPushError(500);
      }
    });

    const res = await postPush({ ...sample, topic: 'media-users' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ attempted: 4, failed: 3 });

    const remaining = getDb()
      .prepare(`SELECT endpoint FROM push_subscriptions ORDER BY endpoint`)
      .all() as { endpoint: string }[];
    expect(remaining.map((r) => r.endpoint)).toEqual([
      'https://push.example/ok',
      'https://push.example/transient',
    ]);
  });

  it('returns 403 and dispatches nothing for non-admin and unauthenticated', async () => {
    seedSubscription('https://push.example/a', ['media-users']);

    const nonAdmin = await postPush(sample, mutatingHeaders({ 'Remote-Groups': 'media-users' }));
    expect(nonAdmin.status).toBe(403);
    expect(await nonAdmin.json()).toEqual({ code: ErrorCodes.forbidden });
    expect(sendMock).not.toHaveBeenCalled();

    const unauth = await app().request('/api/admin/push', {
      method: 'POST',
      headers: {
        Origin: testEnv.allowedOrigin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sample),
    });
    expect(unauth.status).toBe(401);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejects invalid bodies with 400', async () => {
    const res = await postPush({ title: 'x', body: 'y', url: null, topic: 'not-a-group' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: ErrorCodes.invalidBody });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('does not log or store the title, body, or url that was sent', async () => {
    seedSubscription('https://push.example/a', ['media-users']);

    await postPush({ ...sample, topic: 'media-users' });

    const logSpy = vi.mocked(console.log);
    const warnSpy = vi.mocked(console.warn);
    const errorSpy = vi.mocked(console.error);
    const allOutput = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls]
      .flat()
      .map(String)
      .join('\n');

    expect(allOutput).not.toContain('Secret title');
    expect(allOutput).not.toContain('Secret body');
    expect(allOutput).not.toContain('/secret-url');

    const alertCount = (getDb().prepare(`SELECT COUNT(*) AS n FROM alerts`).get() as { n: number })
      .n;
    expect(alertCount).toBe(0);

    // No send-history table: only push_subscriptions rows remain.
    const tables = getDb()
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).not.toContain('push_sends');
    expect(tables.map((t) => t.name)).not.toContain('push_history');
  });

  it('returns attempted 0 when the topic has no subscriptions', async () => {
    seedSubscription('https://push.example/a', ['media-users']);
    const res = await postPush({ ...sample, topic: 'media-admins' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ attempted: 0, failed: 0 });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
