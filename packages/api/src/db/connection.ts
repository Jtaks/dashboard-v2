import BetterSqlite3 from 'better-sqlite3';
import type Database from 'better-sqlite3';

import { DEFAULT_DATABASE_PATH } from '../lib/env.js';

let database: Database.Database | null = null;

export function openDatabase(databasePath: string = DEFAULT_DATABASE_PATH): Database.Database {
  if (database) {
    return database;
  }

  database = new BetterSqlite3(databasePath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  return database;
}

export function getDatabase(): Database.Database {
  if (!database) {
    throw new Error('Database has not been initialized. Call openDatabase() at startup.');
  }

  return database;
}

/** @internal */
export function resetDatabaseForTesting(): void {
  if (database) {
    database.close();
    database = null;
  }
}
