import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Alert } from '@dashboard/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { insertAlert } from './alerts/index.js';
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
  const dir = mkdtempSync(join(tmpdir(), 'dashboard-alerts-read-'));
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

describe('GET /api/alerts', () => {
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

  function seedMultiTopicAlerts() {
    const db = getDb();
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60 * 60_000).toISOString();

    // Insert oldest first so listAlerts ORDER BY created_at DESC is meaningful.
    const expired = insertAlert(db, {
      severity: 'error',
      title: 'Expired wildcard',
      body: null,
      topic: '*',
      endsAt: past,
      createdBy: 'admin',
    });
    // Force older created_at for deterministic ordering assertions.
    db.prepare(`UPDATE alerts SET created_at = ? WHERE id = ?`).run(
      '2024-01-01T00:00:00.000Z',
      expired.id,
    );

    const mediaOnly = insertAlert(db, {
      severity: 'warning',
      title: 'Media only',
      body: 'For media-users',
      topic: 'media-users',
      endsAt: null,
      createdBy: 'admin',
    });
    db.prepare(`UPDATE alerts SET created_at = ? WHERE id = ?`).run(
      '2024-02-01T00:00:00.000Z',
      mediaOnly.id,
    );

    const docsOnly = insertAlert(db, {
      severity: 'info',
      title: 'Docs only',
      body: null,
      topic: 'docs-users',
      endsAt: null,
      createdBy: 'admin',
    });
    db.prepare(`UPDATE alerts SET created_at = ? WHERE id = ?`).run(
      '2024-03-01T00:00:00.000Z',
      docsOnly.id,
    );

    const futureWildcard = insertAlert(db, {
      severity: 'success',
      title: 'Everyone future',
      body: 'Still live',
      topic: '*',
      endsAt: future,
      createdBy: 'admin',
    });
    db.prepare(`UPDATE alerts SET created_at = ? WHERE id = ?`).run(
      '2024-04-01T00:00:00.000Z',
      futureWildcard.id,
    );

    const openWildcard = insertAlert(db, {
      severity: 'info',
      title: 'Everyone open',
      body: null,
      topic: '*',
      endsAt: null,
      createdBy: 'admin',
    });
    db.prepare(`UPDATE alerts SET created_at = ? WHERE id = ?`).run(
      '2024-05-01T00:00:00.000Z',
      openWildcard.id,
    );

    return { mediaOnly, docsOnly, futureWildcard, openWildcard, expired, future };
  }

  it('returns only alerts targeted at each user, excluding expired rows', async () => {
    const { mediaOnly, docsOnly, futureWildcard, openWildcard } = seedMultiTopicAlerts();

    const mediaRes = await app().request('/api/alerts', {
      headers: remoteHeaders({
        'Remote-User': 'media-user',
        'Remote-Groups': 'media-users',
        'Remote-Email': 'media@example.com',
        'Remote-Name': 'Media User',
      }),
    });
    expect(mediaRes.status).toBe(200);
    const mediaAlerts = (await mediaRes.json()) as Alert[];
    expect(mediaAlerts.map((a) => a.id)).toEqual([
      openWildcard.id,
      futureWildcard.id,
      mediaOnly.id,
    ]);
    expect(mediaAlerts.every((a) => !('createdBy' in a) && !('created_by' in a))).toBe(true);
    expect(mediaAlerts[0]).toEqual({
      id: openWildcard.id,
      severity: 'info',
      title: 'Everyone open',
      body: null,
      topic: '*',
      endsAt: null,
      createdAt: '2024-05-01T00:00:00.000Z',
    });

    // Same DB, different Remote-Groups — no write in between.
    const docsRes = await app().request('/api/alerts', {
      headers: remoteHeaders({
        'Remote-User': 'docs-user',
        'Remote-Groups': 'docs-users',
        'Remote-Email': 'docs@example.com',
        'Remote-Name': 'Docs User',
      }),
    });
    expect(docsRes.status).toBe(200);
    const docsAlerts = (await docsRes.json()) as Alert[];
    expect(docsAlerts.map((a) => a.id)).toEqual([
      openWildcard.id,
      futureWildcard.id,
      docsOnly.id,
    ]);
    expect(docsAlerts.find((a) => a.id === mediaOnly.id)).toBeUndefined();
  });

  it('does not grant adminGroup an unfiltered view', async () => {
    const { mediaOnly, openWildcard, futureWildcard } = seedMultiTopicAlerts();

    const res = await app().request('/api/alerts', {
      headers: remoteHeaders({
        'Remote-User': 'admin',
        'Remote-Groups': 'system-admins',
        'Remote-Email': 'admin@example.com',
        'Remote-Name': 'Admin User',
      }),
    });
    expect(res.status).toBe(200);
    const alerts = (await res.json()) as Alert[];
    expect(alerts.map((a) => a.id)).toEqual([openWildcard.id, futureWildcard.id]);
    expect(alerts.find((a) => a.id === mediaOnly.id)).toBeUndefined();
  });

  it('answers 401 when identity headers are absent', async () => {
    seedMultiTopicAlerts();

    const res = await app().request('/api/alerts');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: ErrorCodes.unauthorized });
  });
});
