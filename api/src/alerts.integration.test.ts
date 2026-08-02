import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Alert } from '@dashboard/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';
import { loadConfig, resetConfigForTests, type ResolvedConfig } from './config.js';
import { ensureDatabase, getDb, resetDatabaseForTests } from './db/index.js';
import { ErrorCodes } from './errors.js';
import type { RuntimeEnv } from './env.js';
import { createLogger } from './logging.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const testEnv: RuntimeEnv = {
  port: 3000,
  logLevel: 'error',
  allowedOrigin: 'https://dashboard.example.com',
  autheliaLogoutUrl: 'https://auth.example.com/logout',
  dockerProxyUrl: undefined,
};

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dashboard-alerts-'));
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

describe('admin alerts endpoints', () => {
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
    });
  }

  it('creates an alert, lists it, and ignores forged id/created_by in the body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const createRes = await app().request('/api/admin/alerts', {
      method: 'POST',
      headers: mutatingHeaders(),
      body: JSON.stringify({
        id: 'forged-id',
        created_by: 'eve',
        createdBy: 'eve',
        severity: 'warning',
        title: 'Maintenance',
        body: 'Tonight',
        topic: 'media-users',
        endsAt: null,
      }),
    });

    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as Alert;
    expect(created.id).not.toBe('forged-id');
    expect(created).toEqual({
      id: created.id,
      severity: 'warning',
      title: 'Maintenance',
      body: 'Tonight',
      topic: 'media-users',
      endsAt: null,
      createdAt: created.createdAt,
    });
    expect(created).not.toHaveProperty('created_by');
    expect(created).not.toHaveProperty('createdBy');

    const row = getDb()
      .prepare(`SELECT id, created_by FROM alerts WHERE id = ?`)
      .get(created.id) as { id: string; created_by: string };
    expect(row.created_by).toBe('alice');
    expect(row.id).toBe(created.id);

    const listRes = await app().request('/api/admin/alerts', {
      headers: remoteHeaders(),
    });
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as Alert[];
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(created);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects bad severity and topic without writing a row', async () => {
    const badSeverity = await app().request('/api/admin/alerts', {
      method: 'POST',
      headers: mutatingHeaders(),
      body: JSON.stringify({
        severity: 'critical',
        title: 'Nope',
        topic: 'media-users',
      }),
    });
    expect(badSeverity.status).toBe(400);
    expect(await badSeverity.json()).toEqual({ code: ErrorCodes.invalidBody });

    const badTopic = await app().request('/api/admin/alerts', {
      method: 'POST',
      headers: mutatingHeaders(),
      body: JSON.stringify({
        severity: 'info',
        title: 'Nope',
        topic: 'not-configured',
      }),
    });
    expect(badTopic.status).toBe(400);
    expect(await badTopic.json()).toEqual({ code: ErrorCodes.invalidBody });

    const count = (
      getDb().prepare(`SELECT COUNT(*) AS n FROM alerts`).get() as { n: number }
    ).n;
    expect(count).toBe(0);
  });

  it('PATCHes only endsAt, and answers 404 for unknown ids on PATCH and DELETE', async () => {
    const createRes = await app().request('/api/admin/alerts', {
      method: 'POST',
      headers: mutatingHeaders(),
      body: JSON.stringify({
        severity: 'info',
        title: 'Title',
        body: 'Body',
        topic: '*',
        endsAt: null,
      }),
    });
    const created = (await createRes.json()) as Alert;

    const patchRes = await app().request(`/api/admin/alerts/${created.id}`, {
      method: 'PATCH',
      headers: mutatingHeaders(),
      body: JSON.stringify({ endsAt: '2030-06-01T12:00:00.000Z' }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as Alert;
    expect(patched).toEqual({
      ...created,
      endsAt: '2030-06-01T12:00:00.000Z',
    });

    const row = getDb()
      .prepare(`SELECT title, body, topic, severity, created_by, created_at FROM alerts WHERE id = ?`)
      .get(created.id) as {
      title: string;
      body: string;
      topic: string;
      severity: string;
      created_by: string;
      created_at: string;
    };
    expect(row.title).toBe('Title');
    expect(row.body).toBe('Body');
    expect(row.topic).toBe('*');
    expect(row.severity).toBe('info');
    expect(row.created_by).toBe('alice');
    expect(row.created_at).toBe(created.createdAt);

    const missingPatch = await app().request('/api/admin/alerts/missing-id', {
      method: 'PATCH',
      headers: mutatingHeaders(),
      body: JSON.stringify({ title: 'x' }),
    });
    expect(missingPatch.status).toBe(404);
    expect(await missingPatch.json()).toEqual({ code: ErrorCodes.notFound });

    const missingDelete = await app().request('/api/admin/alerts/missing-id', {
      method: 'DELETE',
      headers: mutatingHeaders(),
    });
    expect(missingDelete.status).toBe(404);
    expect(await missingDelete.json()).toEqual({ code: ErrorCodes.notFound });
  });

  it('includes alerts whose ends_at is in the past in the admin list', async () => {
    const createRes = await app().request('/api/admin/alerts', {
      method: 'POST',
      headers: mutatingHeaders(),
      body: JSON.stringify({
        severity: 'error',
        title: 'Expired',
        body: null,
        topic: 'media-admins',
        endsAt: '2020-01-01T00:00:00.000Z',
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as Alert;

    const listRes = await app().request('/api/admin/alerts', {
      headers: remoteHeaders(),
    });
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as Alert[];
    expect(list).toEqual([created]);
    expect(list[0]?.endsAt).toBe('2020-01-01T00:00:00.000Z');
  });

  it('deletes an alert by id', async () => {
    const createRes = await app().request('/api/admin/alerts', {
      method: 'POST',
      headers: mutatingHeaders(),
      body: JSON.stringify({
        severity: 'success',
        title: 'Gone soon',
        topic: '*',
      }),
    });
    const created = (await createRes.json()) as Alert;

    const delRes = await app().request(`/api/admin/alerts/${created.id}`, {
      method: 'DELETE',
      headers: mutatingHeaders(),
    });
    expect(delRes.status).toBe(204);

    const listRes = await app().request('/api/admin/alerts', {
      headers: remoteHeaders(),
    });
    expect(await listRes.json()).toEqual([]);
  });

  it.each(['GET', 'POST', 'PATCH', 'DELETE'] as const)(
    'answers 401 unauthenticated for %s /api/admin/alerts',
    async (method) => {
      const path =
        method === 'PATCH' || method === 'DELETE'
          ? '/api/admin/alerts/some-id'
          : '/api/admin/alerts';
      const init: RequestInit = { method };
      if (method === 'POST' || method === 'PATCH') {
        init.headers = {
          Origin: testEnv.allowedOrigin,
          'Content-Type': 'application/json',
        };
        init.body = JSON.stringify({ severity: 'info', title: 'x', topic: '*' });
      } else if (method === 'DELETE') {
        init.headers = { Origin: testEnv.allowedOrigin };
      }

      const res = await app().request(path, init);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ code: ErrorCodes.unauthorized });
    },
  );

  it.each(['GET', 'POST', 'PATCH', 'DELETE'] as const)(
    'answers 403 for a non-admin on %s /api/admin/alerts',
    async (method) => {
      const path =
        method === 'PATCH' || method === 'DELETE'
          ? '/api/admin/alerts/some-id'
          : '/api/admin/alerts';
      const init: RequestInit = { method };
      if (method === 'POST' || method === 'PATCH') {
        init.headers = mutatingHeaders({ 'Remote-Groups': 'media-users' });
        init.body = JSON.stringify({ severity: 'info', title: 'x', topic: '*' });
      } else if (method === 'DELETE') {
        init.headers = mutatingHeaders({ 'Remote-Groups': 'media-users' });
      } else {
        init.headers = remoteHeaders({ 'Remote-Groups': 'media-users' });
      }

      const res = await app().request(path, init);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ code: ErrorCodes.forbidden });
    },
  );
});
