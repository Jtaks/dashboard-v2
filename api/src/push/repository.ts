import type Database from 'better-sqlite3';

/** Row from `push_subscriptions` as declared in the TDD data model. */
export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
};

export type UpsertPushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userId: string;
};

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
  created_at: string;
  last_seen_at: string;
};

function rowToRecord(row: PushSubscriptionRow): PushSubscriptionRecord {
  return {
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    userId: row.user_id,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

/**
 * Upsert keyed on `endpoint`. Preserves `created_at` on conflict and advances `last_seen_at`.
 * Updates keys and `user_id` when the same endpoint returns under a different user.
 */
export function upsertSubscription(
  db: Database.Database,
  input: UpsertPushSubscriptionInput,
  now: () => Date = () => new Date(),
): PushSubscriptionRecord {
  const at = now().toISOString();

  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id, created_at, last_seen_at)
     VALUES (@endpoint, @p256dh, @auth, @user_id, @created_at, @last_seen_at)
     ON CONFLICT(endpoint) DO UPDATE SET
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       user_id = excluded.user_id,
       last_seen_at = excluded.last_seen_at`,
  ).run({
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    user_id: input.userId,
    created_at: at,
    last_seen_at: at,
  });

  const row = db
    .prepare(
      `SELECT endpoint, p256dh, auth, user_id, created_at, last_seen_at
       FROM push_subscriptions
       WHERE endpoint = ?`,
    )
    .get(input.endpoint) as PushSubscriptionRow;

  return rowToRecord(row);
}

/** Delete by endpoint. Returns true when a row was removed. Topics cascade via FK. */
export function deleteSubscription(db: Database.Database, endpoint: string): boolean {
  const result = db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).run(endpoint);
  return result.changes > 0;
}

/**
 * Replace the full topic set for one endpoint inside a single transaction.
 * A partial rewrite would leave a device addressed by a group it has left.
 */
export function rewriteTopics(
  db: Database.Database,
  endpoint: string,
  topics: readonly string[],
): void {
  const run = db.transaction((ep: string, next: readonly string[]) => {
    db.prepare(`DELETE FROM push_subscription_topics WHERE endpoint = ?`).run(ep);
    const insert = db.prepare(
      `INSERT INTO push_subscription_topics (endpoint, topic) VALUES (?, ?)`,
    );
    for (const topic of next) {
      insert.run(ep, topic);
    }
  });
  run(endpoint, topics);
}

/** Topics currently stored for an endpoint (unordered). */
export function listTopicsForEndpoint(db: Database.Database, endpoint: string): string[] {
  const rows = db
    .prepare(`SELECT topic FROM push_subscription_topics WHERE endpoint = ? ORDER BY topic`)
    .all(endpoint) as { topic: string }[];
  return rows.map((r) => r.topic);
}

/**
 * Distinct endpoints carrying any of the given topics (indexed join).
 * An endpoint matching more than one topic is returned once.
 */
export function listEndpointsByTopics(
  db: Database.Database,
  topics: readonly string[],
): PushSubscriptionRecord[] {
  if (topics.length === 0) {
    return [];
  }

  const placeholders = topics.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT DISTINCT s.endpoint, s.p256dh, s.auth, s.user_id, s.created_at, s.last_seen_at
       FROM push_subscriptions s
       INNER JOIN push_subscription_topics t ON t.endpoint = s.endpoint
       WHERE t.topic IN (${placeholders})
       ORDER BY s.endpoint`,
    )
    .all(...topics) as PushSubscriptionRow[];

  return rows.map(rowToRecord);
}

/** Distinct endpoints carrying a single topic. */
export function listEndpointsByTopic(
  db: Database.Database,
  topic: string,
): PushSubscriptionRecord[] {
  return listEndpointsByTopics(db, [topic]);
}

/** Every subscription endpoint (the `*` audience case). */
export function listAllEndpoints(db: Database.Database): PushSubscriptionRecord[] {
  const rows = db
    .prepare(
      `SELECT endpoint, p256dh, auth, user_id, created_at, last_seen_at
       FROM push_subscriptions
       ORDER BY endpoint`,
    )
    .all() as PushSubscriptionRow[];

  return rows.map(rowToRecord);
}
