import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { openDatabase, resetDatabaseForTesting } from './connection.js';
import { runMigrations } from './migrate.js';
import { migrations, type Migration } from './migrations/index.js';

let tempDirectory: string | null = null;

function databasePath(): string {
  if (!tempDirectory) {
    tempDirectory = mkdtempSync(join(tmpdir(), 'dashboard-db-'));
  }

  return join(tempDirectory, 'dashboard.db');
}

afterEach(() => {
  resetDatabaseForTesting();
  if (tempDirectory) {
    rmSync(tempDirectory, { recursive: true, force: true });
    tempDirectory = null;
  }
});

describe('database migrations', () => {
  it('creates all tables on an empty file', () => {
    const db = openDatabase(databasePath());
    runMigrations(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining(['alerts', 'push_subscriptions', 'push_subscription_topics', '_migrations']),
    );

    const alertColumns = db.prepare('PRAGMA table_info(alerts)').all() as Array<{ name: string }>;
    expect(alertColumns.map((column) => column.name)).toEqual([
      'id',
      'severity',
      'title',
      'body',
      'topic',
      'ends_at',
      'created_at',
      'created_by',
    ]);
  });

  it('is idempotent when run twice', () => {
    const db = openDatabase(databasePath());
    runMigrations(db);
    const firstCount = (
      db.prepare('SELECT COUNT(*) as count FROM _migrations').get() as { count: number }
    ).count;

    runMigrations(db);
    const secondCount = (
      db.prepare('SELECT COUNT(*) as count FROM _migrations').get() as { count: number }
    ).count;

    expect(secondCount).toBe(firstCount);
  });

  it('uses WAL journal mode after startup', () => {
    const db = openDatabase(databasePath());
    runMigrations(db);

    const journalMode = db.pragma('journal_mode', { simple: true }) as string;
    expect(journalMode.toLowerCase()).toBe('wal');
  });

  it('cascades topic deletion when a subscription is removed', () => {
    const db = openDatabase(databasePath());
    runMigrations(db);

    db.prepare(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('https://push.example/1', 'p256dh', 'auth', 'alice', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    db.prepare('INSERT INTO push_subscription_topics (endpoint, topic) VALUES (?, ?)').run(
      'https://push.example/1',
      'media-users',
    );

    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run('https://push.example/1');

    const remaining = db
      .prepare('SELECT COUNT(*) as count FROM push_subscription_topics')
      .get() as { count: number };
    expect(remaining.count).toBe(0);
  });

  it('rolls back a failed migration and exits non-zero', () => {
    const db = openDatabase(databasePath());
    const brokenMigration: Migration = {
      id: 'broken',
      up() {
        db.exec('CREATE TABLE broken_test (id TEXT PRIMARY KEY)');
        throw new Error('migration failed');
      },
    };

    expect(() => runMigrations(db, [...migrations, brokenMigration])).toThrow('migration failed');

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'broken_test'")
      .all();
    expect(tables).toHaveLength(0);

    const applied = db.prepare('SELECT id FROM _migrations WHERE id = ?').get('broken');
    expect(applied).toBeUndefined();
  });

  it('exits non-zero when runMigrationsOrExit fails', async () => {
    const { runMigrationsOrExit } = await import('./migrate.js');
    const db = openDatabase(databasePath());
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as typeof process.exit);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const brokenMigration: Migration = {
      id: 'broken-exit',
      up() {
        throw new Error('boom');
      },
    };

    expect(() => runMigrationsOrExit(db, [brokenMigration])).toThrow('process.exit');
    expect(exit).toHaveBeenCalledWith(1);
  });
});
