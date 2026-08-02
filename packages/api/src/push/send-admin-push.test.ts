import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { openDatabase, resetDatabaseForTesting } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { createPushSubscriptionsRepository } from './push-subscriptions-repository.js';
import { sendAdminPush, type SendNotification } from './send-admin-push.js';

let tempDirectory: string | null = null;

function createRepository() {
  if (!tempDirectory) {
    tempDirectory = mkdtempSync(join(tmpdir(), 'dashboard-send-push-'));
  }

  const db = openDatabase(join(tempDirectory, 'dashboard.db'));
  runMigrations(db);
  return createPushSubscriptionsRepository(db);
}

function seedSubscription(
  repository: ReturnType<typeof createPushSubscriptionsRepository>,
  endpoint: string,
  topics: string[],
) {
  repository.upsert({
    endpoint,
    p256dh: `p256dh-${endpoint}`,
    auth: `auth-${endpoint}`,
    userId: 'alice',
  });
  repository.rewriteTopics(endpoint, topics);
}

afterEach(() => {
  resetDatabaseForTesting();
  if (tempDirectory) {
    rmSync(tempDirectory, { recursive: true, force: true });
    tempDirectory = null;
  }
});

describe('sendAdminPush', () => {
  it('serialises the PushSend payload for each endpoint', async () => {
    const repository = createRepository();
    seedSubscription(repository, 'https://push.example/1', ['media-users']);

    const sendNotification = vi.fn<SendNotification>().mockResolvedValue({} as never);
    const payload = {
      title: 'Maintenance',
      body: 'Expect downtime.',
      url: 'https://dashboard.example.com/status',
      topic: 'media-users',
    };

    await sendAdminPush(repository, payload, sendNotification);

    expect(sendNotification).toHaveBeenCalledOnce();
    expect(sendNotification).toHaveBeenCalledWith(
      {
        endpoint: 'https://push.example/1',
        keys: {
          p256dh: 'p256dh-https://push.example/1',
          auth: 'auth-https://push.example/1',
        },
      },
      JSON.stringify(payload),
    );
  });

  it('deletes subscriptions answered 404 or 410 and counts them as failed', async () => {
    const repository = createRepository();
    seedSubscription(repository, 'https://push.example/gone', ['media-users']);
    seedSubscription(repository, 'https://push.example/expired', ['media-users']);

    const sendNotification = vi
      .fn<SendNotification>()
      .mockRejectedValueOnce({ statusCode: 404 })
      .mockRejectedValueOnce({ statusCode: 410 });

    const result = await sendAdminPush(
      repository,
      {
        title: 'Title',
        body: 'Body',
        url: null,
        topic: 'media-users',
      },
      sendNotification,
    );

    expect(result).toEqual({ attempted: 2, failed: 2 });
    expect(repository.getByEndpoint('https://push.example/gone')).toBeNull();
    expect(repository.getByEndpoint('https://push.example/expired')).toBeNull();
  });

  it('keeps subscriptions on transient failures', async () => {
    const repository = createRepository();
    seedSubscription(repository, 'https://push.example/retry', ['media-users']);

    const sendNotification = vi.fn<SendNotification>().mockRejectedValue({ statusCode: 500 });

    const result = await sendAdminPush(
      repository,
      {
        title: 'Title',
        body: 'Body',
        url: null,
        topic: 'media-users',
      },
      sendNotification,
    );

    expect(result).toEqual({ attempted: 1, failed: 1 });
    expect(repository.getByEndpoint('https://push.example/retry')).not.toBeNull();
  });
});
