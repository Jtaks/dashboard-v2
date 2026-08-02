import type Database from 'better-sqlite3';

import { migrations, type Migration } from './migrations/index.js';

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          TEXT PRIMARY KEY,
      applied_at  TEXT NOT NULL
    );
  `);
}

function appliedMigrationIds(db: Database.Database): Set<string> {
  ensureMigrationsTable(db);
  const rows = db.prepare('SELECT id FROM _migrations').all() as Array<{ id: string }>;
  return new Set(rows.map((row) => row.id));
}

export function runMigrations(
  db: Database.Database,
  migrationSet: Migration[] = migrations,
): void {
  ensureMigrationsTable(db);
  const applied = appliedMigrationIds(db);
  const pending = migrationSet.filter((migration) => !applied.has(migration.id));

  for (const migration of pending) {
    const apply = db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)').run(
        migration.id,
        new Date().toISOString(),
      );
    });

    apply();
  }
}

export function runMigrationsOrExit(
  db: Database.Database,
  migrationSet: Migration[] = migrations,
): void {
  try {
    runMigrations(db, migrationSet);
  } catch (error) {
    console.error('Database migration failed');
    console.error(error);
    process.exit(1);
    throw error;
  }
}
