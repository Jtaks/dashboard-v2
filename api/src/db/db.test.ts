import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_DATABASE_PATH,
  ensureDatabase,
  ensureDatabaseOrExit,
  getDb,
  migrations,
  openDatabase,
  resetDatabaseForTests,
  resolveDatabasePath,
  runMigrations,
  type Migration,
} from './index.js';

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dashboard-db-'));
  return join(dir, 'dashboard.db');
}

function cleanupDbPath(path: string): void {
  rmSync(dirname(path), { recursive: true, force: true });
}

function tableColumns(db: Database.Database, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

afterEach(() => {
  resetDatabaseForTests();
  vi.restoreAllMocks();
});

describe('resolveDatabasePath', () => {
  it('defaults to the TDD deployment path', () => {
    expect(resolveDatabasePath({})).toBe(DEFAULT_DATABASE_PATH);
  });

  it('reads DATABASE_PATH from the environment', () => {
    expect(resolveDatabasePath({ DATABASE_PATH: '/tmp/custom.db' })).toBe('/tmp/custom.db');
  });
});

describe('ensureDatabase / migrations', () => {
  it('migrates an empty directory into all three tables with the TDD columns', () => {
    const path = tempDbPath();
    try {
      const db = ensureDatabase(path);

      const tables = (
        db
          .prepare(
            `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
          )
          .all() as Array<{ name: string }>
      ).map((row) => row.name);

      expect(tables).toEqual([
        'alerts',
        'push_subscription_topics',
        'push_subscriptions',
        'schema_migrations',
      ]);

      expect(tableColumns(db, 'alerts')).toEqual([
        'id',
        'severity',
        'title',
        'body',
        'topic',
        'ends_at',
        'created_at',
        'created_by',
      ]);
      expect(tableColumns(db, 'push_subscriptions')).toEqual([
        'endpoint',
        'p256dh',
        'auth',
        'user_id',
        'created_at',
        'last_seen_at',
      ]);
      expect(tableColumns(db, 'push_subscription_topics')).toEqual(['endpoint', 'topic']);

      expect(getDb()).toBe(db);
    } finally {
      resetDatabaseForTests();
      cleanupDbPath(path);
    }
  });

  it('is idempotent: a second migrate applies nothing', () => {
    const path = tempDbPath();
    try {
      ensureDatabase(path);
      resetDatabaseForTests();

      const db = openDatabase(path);
      const before = (
        db.prepare('SELECT id FROM schema_migrations ORDER BY id').all() as Array<{ id: string }>
      ).map((row) => row.id);

      runMigrations(db);

      const after = (
        db.prepare('SELECT id FROM schema_migrations ORDER BY id').all() as Array<{ id: string }>
      ).map((row) => row.id);

      expect(after).toEqual(before);
      expect(after).toEqual(migrations.map((m) => m.id));
    } finally {
      resetDatabaseForTests();
      cleanupDbPath(path);
    }
  });

  it('reports journal_mode wal after startup', () => {
    const path = tempDbPath();
    try {
      const db = ensureDatabase(path);
      const mode = db.pragma('journal_mode', { simple: true });
      expect(mode).toBe('wal');
    } finally {
      resetDatabaseForTests();
      cleanupDbPath(path);
    }
  });

  it('cascades deletes from push_subscriptions to push_subscription_topics', () => {
    const path = tempDbPath();
    try {
      const db = ensureDatabase(path);

      db.prepare(
        `INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        'https://push.example/1',
        'k',
        'a',
        'alice',
        '2026-01-01T00:00:00Z',
        '2026-01-01T00:00:00Z',
      );

      db.prepare(`INSERT INTO push_subscription_topics (endpoint, topic) VALUES (?, ?)`).run(
        'https://push.example/1',
        'media-users',
      );
      db.prepare(`INSERT INTO push_subscription_topics (endpoint, topic) VALUES (?, ?)`).run(
        'https://push.example/1',
        '*',
      );

      expect(
        (db.prepare('SELECT COUNT(*) AS n FROM push_subscription_topics').get() as { n: number }).n,
      ).toBe(2);

      db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(
        'https://push.example/1',
      );

      expect(
        (db.prepare('SELECT COUNT(*) AS n FROM push_subscription_topics').get() as { n: number }).n,
      ).toBe(0);
    } finally {
      resetDatabaseForTests();
      cleanupDbPath(path);
    }
  });

  it('rolls back a throwing migration and leaves the previous schema version', () => {
    const path = tempDbPath();
    try {
      const db = ensureDatabase(path);

      const appliedBefore = (
        db.prepare('SELECT id FROM schema_migrations ORDER BY id').all() as Array<{ id: string }>
      ).map((row) => row.id);

      const broken: Migration = {
        id: '999_broken',
        up: () => {
          throw new Error('deliberate migration failure');
        },
      };

      expect(() => runMigrations(db, [...migrations, broken])).toThrow(
        'deliberate migration failure',
      );

      const appliedAfter = (
        db.prepare('SELECT id FROM schema_migrations ORDER BY id').all() as Array<{ id: string }>
      ).map((row) => row.id);

      expect(appliedAfter).toEqual(appliedBefore);
      expect(appliedAfter).not.toContain('999_broken');

      const tables = (
        db
          .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'alerts'`)
          .all() as Array<{ name: string }>
      ).map((row) => row.name);
      expect(tables).toEqual(['alerts']);
    } finally {
      resetDatabaseForTests();
      cleanupDbPath(path);
    }
  });
});

describe('ensureDatabaseOrExit', () => {
  it('exits non-zero when opening the database fails', () => {
    const root = mkdtempSync(join(tmpdir(), 'dashboard-db-bad-'));
    const notADir = join(root, 'not-a-dir');
    writeFileSync(notADir, 'not a directory');
    const badPath = join(notADir, 'dashboard.db');

    const error = vi.fn();
    const exit = vi.fn((code: number) => {
      throw new Error(`exit ${code}`);
    }) as unknown as (code: number) => never;

    try {
      expect(() => ensureDatabaseOrExit(badPath, { error }, exit)).toThrow('exit 1');
      expect(exit).toHaveBeenCalledWith(1);
      expect(error).toHaveBeenCalled();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('exits non-zero when a migration throws', () => {
    const path = tempDbPath();
    try {
      ensureDatabase(path);
      resetDatabaseForTests();

      const broken: Migration = {
        id: '999_broken',
        up: () => {
          throw new Error('deliberate migration failure');
        },
      };

      const error = vi.fn();
      const exit = vi.fn((code: number) => {
        throw new Error(`exit ${code}`);
      }) as unknown as (code: number) => never;

      expect(() =>
        ensureDatabaseOrExit(path, { error }, exit, {
          migrations: [...migrations, broken],
        }),
      ).toThrow('exit 1');
      expect(exit).toHaveBeenCalledWith(1);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('deliberate migration failure'),
      );

      resetDatabaseForTests();
      const db = openDatabase(path);
      const applied = (
        db.prepare('SELECT id FROM schema_migrations ORDER BY id').all() as Array<{ id: string }>
      ).map((row) => row.id);
      expect(applied).toEqual(migrations.map((m) => m.id));
      expect(applied).not.toContain('999_broken');
    } finally {
      resetDatabaseForTests();
      cleanupDbPath(path);
    }
  });
});
