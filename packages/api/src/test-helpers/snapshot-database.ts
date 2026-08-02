import type Database from 'better-sqlite3';

export function snapshotDatabase(db: Database.Database): string {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as { name: string }[];

  const snapshot: Record<string, unknown[]> = {};

  for (const { name } of tables) {
    snapshot[name] = db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all();
  }

  return JSON.stringify(snapshot);
}
