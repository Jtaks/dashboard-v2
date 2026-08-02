import type Database from 'better-sqlite3';

export type Migration = {
  id: string;
  up: (db: Database.Database) => void;
};

export const migrations: Migration[] = [
  {
    id: '001_initial',
    up(db) {
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
    },
  },
  {
    id: '002_push_subscription_topics_topic_index',
    up(db) {
      db.exec(`
        CREATE INDEX idx_push_subscription_topics_topic
        ON push_subscription_topics(topic);
      `);
    },
  },
];
