import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

import { runMigrations, type Migration } from './migrate.js';

/** Default mount path from TDD Deployment. */
export const DEFAULT_DATABASE_PATH = '/data/dashboard.db';

export type EnsureDatabaseOptions = {
  /** Override the default migration list (tests). */
  migrations?: readonly Migration[];
};

export type DatabaseLogger = {
  error: (message: string) => void;
};

const defaultLogger: DatabaseLogger = {
  error: (message) => console.error(message),
};

let sharedDb: Database.Database | undefined;
let sharedPath: string | undefined;

export function resolveDatabasePath(env: NodeJS.ProcessEnv = process.env): string {
  return env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH;
}

/**
 * Open (or create) the SQLite file at `path`, enable WAL + foreign keys,
 * and retain one shared connection for the process.
 */
export function openDatabase(path: string = resolveDatabasePath()): Database.Database {
  if (sharedDb !== undefined && sharedPath === path) {
    return sharedDb;
  }

  if (sharedDb !== undefined) {
    sharedDb.close();
    sharedDb = undefined;
    sharedPath = undefined;
  }

  mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  sharedDb = db;
  sharedPath = path;
  return db;
}

/** Shared connection from the last {@link openDatabase} / {@link ensureDatabase}. */
export function getDb(): Database.Database {
  if (sharedDb === undefined) {
    throw new Error('Database has not been opened');
  }
  return sharedDb;
}

/**
 * Open the database and apply pending migrations.
 * Call this before the HTTP listener binds.
 */
export function ensureDatabase(
  path: string = resolveDatabasePath(),
  options: EnsureDatabaseOptions = {},
): Database.Database {
  const db = openDatabase(path);
  runMigrations(db, options.migrations);
  return db;
}

/**
 * Open + migrate, or log and exit non-zero on failure.
 * Intended for process startup before the HTTP listener binds.
 */
export function ensureDatabaseOrExit(
  path?: string,
  logger: DatabaseLogger = defaultLogger,
  exit: (code: number) => never = (code) => process.exit(code) as never,
  options: EnsureDatabaseOptions = {},
): Database.Database {
  try {
    return ensureDatabase(path ?? resolveDatabasePath(), options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`database: ${message}`);
    exit(1);
  }
}

/** Test helper: close the shared connection so the next open starts clean. */
export function resetDatabaseForTests(): void {
  if (sharedDb !== undefined) {
    sharedDb.close();
    sharedDb = undefined;
    sharedPath = undefined;
  }
}

export { runMigrations, migrations } from './migrate.js';
export type { Migration } from './migrate.js';
