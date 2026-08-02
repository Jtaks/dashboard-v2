import type Database from 'better-sqlite3';

/** First schema: alerts + push subscription tables per TDD Data model. */
export const id = '001_initial';

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE alerts (
      id          TEXT PRIMARY KEY,
      severity    TEXT NOT NULL,
      title       TEXT NOT NULL,
      body        TEXT,
      topic       TEXT NOT NULL,
      ends_at     TEXT,
      created_at  TEXT NOT NULL,
      created_by  TEXT NOT NULL
    );

    CREATE TABLE push_subscriptions (
      endpoint     TEXT PRIMARY KEY,
      p256dh       TEXT NOT NULL,
      auth         TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      created_at   TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE push_subscription_topics (
      endpoint TEXT NOT NULL REFERENCES push_subscriptions(endpoint) ON DELETE CASCADE,
      topic    TEXT NOT NULL,
      PRIMARY KEY (endpoint, topic)
    );
  `);
}
