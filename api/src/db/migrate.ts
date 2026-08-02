import type Database from 'better-sqlite3';

import * as initial from './migrations/001_initial.js';

export type Migration = {
  id: string;
  up: (db: Database.Database) => void;
};

/** Ordered list of schema migrations applied at startup. */
export const migrations: Migration[] = [{ id: initial.id, up: initial.up }];

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`;

/**
 * Apply pending migrations in order, each inside a transaction.
 * Already-recorded migrations are skipped (no-op on a current database).
 * A throwing migration rolls the transaction back and leaves prior schema intact.
 */
export function runMigrations(
  db: Database.Database,
  pending: readonly Migration[] = migrations,
): void {
  db.exec(CREATE_MIGRATIONS_TABLE);

  const applied = new Set(
    (
      db.prepare('SELECT id FROM schema_migrations ORDER BY id').all() as Array<{ id: string }>
    ).map((row) => row.id),
  );

  const insert = db.prepare(
    'INSERT INTO schema_migrations (id, applied_at) VALUES (@id, @applied_at)',
  );

  for (const migration of pending) {
    if (applied.has(migration.id)) {
      continue;
    }

    const apply = db.transaction(() => {
      migration.up(db);
      insert.run({ id: migration.id, applied_at: new Date().toISOString() });
    });

    apply();
  }
}
