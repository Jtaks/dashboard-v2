import type Database from 'better-sqlite3';

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userId: string;
};

export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
  created_at: string;
  last_seen_at: string;
};

type SubscriptionRow = StoredPushSubscription;

function readRow(row: SubscriptionRow | undefined): StoredPushSubscription | null {
  return row ?? null;
}

export function createPushSubscriptionsRepository(db: Database.Database) {
  const upsertStatement = db.prepare(`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id, created_at, last_seen_at)
    VALUES (@endpoint, @p256dh, @auth, @user_id, @created_at, @last_seen_at)
    ON CONFLICT(endpoint) DO UPDATE SET
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_id = excluded.user_id,
      last_seen_at = excluded.last_seen_at
  `);

  const getByEndpointStatement = db.prepare(`
    SELECT endpoint, p256dh, auth, user_id, created_at, last_seen_at
    FROM push_subscriptions
    WHERE endpoint = ?
  `);

  const deleteByEndpointStatement = db.prepare(
    'DELETE FROM push_subscriptions WHERE endpoint = ?',
  );

  const deleteTopicsStatement = db.prepare(
    'DELETE FROM push_subscription_topics WHERE endpoint = ?',
  );

  const insertTopicStatement = db.prepare(
    'INSERT INTO push_subscription_topics (endpoint, topic) VALUES (?, ?)',
  );

  const endpointsForTopicStatement = db.prepare(`
    SELECT DISTINCT endpoint
    FROM push_subscription_topics
    WHERE topic = ?
    ORDER BY endpoint
  `);

  const allEndpointsStatement = db.prepare(`
    SELECT endpoint
    FROM push_subscriptions
    ORDER BY endpoint
  `);

  const rewriteTopics = db.transaction((endpoint: string, topics: string[]) => {
    deleteTopicsStatement.run(endpoint);
    for (const topic of topics) {
      insertTopicStatement.run(endpoint, topic);
    }
  });

  const upsertWithTopicsTransaction = db.transaction(
    (subscription: PushSubscriptionInput, topics: string[], seenAt: string): StoredPushSubscription => {
      const existing = readRow(
        getByEndpointStatement.get(subscription.endpoint) as SubscriptionRow | undefined,
      );
      const createdAt = existing?.created_at ?? seenAt;

      upsertStatement.run({
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        user_id: subscription.userId,
        created_at: createdAt,
        last_seen_at: seenAt,
      });

      deleteTopicsStatement.run(subscription.endpoint);
      for (const topic of topics) {
        insertTopicStatement.run(subscription.endpoint, topic);
      }

      return readRow(
        getByEndpointStatement.get(subscription.endpoint) as SubscriptionRow | undefined,
      )!;
    },
  );

  return {
    upsert(subscription: PushSubscriptionInput, seenAt = new Date().toISOString()): StoredPushSubscription {
      const existing = readRow(getByEndpointStatement.get(subscription.endpoint) as SubscriptionRow | undefined);
      const createdAt = existing?.created_at ?? seenAt;

      upsertStatement.run({
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        user_id: subscription.userId,
        created_at: createdAt,
        last_seen_at: seenAt,
      });

      return readRow(
        getByEndpointStatement.get(subscription.endpoint) as SubscriptionRow | undefined,
      )!;
    },

    upsertWithTopics(
      subscription: PushSubscriptionInput,
      topics: string[],
      seenAt = new Date().toISOString(),
    ): StoredPushSubscription {
      return upsertWithTopicsTransaction(subscription, topics, seenAt);
    },

    getByEndpoint(endpoint: string): StoredPushSubscription | null {
      return readRow(
        getByEndpointStatement.get(endpoint) as SubscriptionRow | undefined,
      );
    },

    deleteByEndpoint(endpoint: string): boolean {
      const result = deleteByEndpointStatement.run(endpoint);
      return result.changes > 0;
    },

    rewriteTopics(endpoint: string, topics: string[]): void {
      rewriteTopics(endpoint, topics);
    },

    listTopics(endpoint: string): string[] {
      const rows = db
        .prepare('SELECT topic FROM push_subscription_topics WHERE endpoint = ? ORDER BY topic')
        .all(endpoint) as Array<{ topic: string }>;
      return rows.map((row) => row.topic);
    },

    endpointsForTopic(topic: string): string[] {
      if (topic === '*') {
        const rows = allEndpointsStatement.all() as Array<{ endpoint: string }>;
        return rows.map((row) => row.endpoint);
      }

      const rows = endpointsForTopicStatement.all(topic) as Array<{ endpoint: string }>;
      return rows.map((row) => row.endpoint);
    },
  };
}

export type PushSubscriptionsRepository = ReturnType<typeof createPushSubscriptionsRepository>;
