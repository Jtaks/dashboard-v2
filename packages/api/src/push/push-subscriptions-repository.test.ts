import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { openDatabase, resetDatabaseForTesting } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { createPushSubscriptionsRepository } from './push-subscriptions-repository.js';

let tempDirectory: string | null = null;

function databasePath(): string {
  if (!tempDirectory) {
    tempDirectory = mkdtempSync(join(tmpdir(), 'dashboard-push-repo-'));
  }

  return join(tempDirectory, 'dashboard.db');
}

function createRepository() {
  const db = openDatabase(databasePath());
  runMigrations(db);
  return createPushSubscriptionsRepository(db);
}

afterEach(() => {
  resetDatabaseForTesting();
  if (tempDirectory) {
    rmSync(tempDirectory, { recursive: true, force: true });
    tempDirectory = null;
  }
});

describe('push subscriptions repository', () => {
  it('upserts the same endpoint once and advances last_seen_at', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const repository = createRepository();
    const first = repository.upsert({
      endpoint: 'https://push.example/1',
      p256dh: 'p256dh-1',
      auth: 'auth-1',
      userId: 'alice',
    });

    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));

    const second = repository.upsert({
      endpoint: 'https://push.example/1',
      p256dh: 'p256dh-2',
      auth: 'auth-2',
      userId: 'alice',
    });

    expect(first.created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(second.created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(second.last_seen_at).toBe('2026-01-02T00:00:00.000Z');
    expect(second.p256dh).toBe('p256dh-2');

    const db = openDatabase(databasePath());
    const count = db.prepare('SELECT COUNT(*) as count FROM push_subscriptions').get() as {
      count: number;
    };
    expect(count.count).toBe(1);

    vi.useRealTimers();
  });

  it('rewrites topics to exactly the new set', () => {
    const repository = createRepository();

    repository.upsert({
      endpoint: 'https://push.example/1',
      p256dh: 'p256dh',
      auth: 'auth',
      userId: 'alice',
    });
    repository.rewriteTopics('https://push.example/1', ['media-users', 'media-admins']);
    repository.rewriteTopics('https://push.example/1', ['other-users']);

    expect(repository.listTopics('https://push.example/1')).toEqual(['other-users']);
  });

  it('removes topic rows when the subscription is deleted', () => {
    const repository = createRepository();

    repository.upsert({
      endpoint: 'https://push.example/1',
      p256dh: 'p256dh',
      auth: 'auth',
      userId: 'alice',
    });
    repository.rewriteTopics('https://push.example/1', ['media-users']);

    expect(repository.deleteByEndpoint('https://push.example/1')).toBe(true);

    const db = openDatabase(databasePath());
    const remaining = db
      .prepare('SELECT COUNT(*) as count FROM push_subscription_topics')
      .get() as { count: number };
    expect(remaining.count).toBe(0);
  });

  it('returns distinct endpoints for a topic', () => {
    const repository = createRepository();

    repository.upsert({
      endpoint: 'https://push.example/1',
      p256dh: 'p256dh-1',
      auth: 'auth-1',
      userId: 'alice',
    });
    repository.rewriteTopics('https://push.example/1', ['media-users', 'media-admins']);

    repository.upsert({
      endpoint: 'https://push.example/2',
      p256dh: 'p256dh-2',
      auth: 'auth-2',
      userId: 'bob',
    });
    repository.rewriteTopics('https://push.example/2', ['media-users']);

    expect(repository.endpointsForTopic('media-users')).toEqual([
      'https://push.example/1',
      'https://push.example/2',
    ]);
    expect(repository.endpointsForTopic('media-users')).toHaveLength(2);
  });

  it('returns every endpoint for the wildcard topic', () => {
    const repository = createRepository();

    repository.upsert({
      endpoint: 'https://push.example/1',
      p256dh: 'p256dh-1',
      auth: 'auth-1',
      userId: 'alice',
    });
    repository.rewriteTopics('https://push.example/1', ['media-users', 'media-admins']);

    repository.upsert({
      endpoint: 'https://push.example/2',
      p256dh: 'p256dh-2',
      auth: 'auth-2',
      userId: 'bob',
    });
    repository.rewriteTopics('https://push.example/2', ['other-users']);

    expect(repository.endpointsForTopic('*')).toEqual([
      'https://push.example/1',
      'https://push.example/2',
    ]);
  });

  it('returns an empty list for a topic no subscription carries', () => {
    const repository = createRepository();

    repository.upsert({
      endpoint: 'https://push.example/1',
      p256dh: 'p256dh-1',
      auth: 'auth-1',
      userId: 'alice',
    });
    repository.rewriteTopics('https://push.example/1', ['media-users']);

    expect(repository.endpointsForTopic('media-admins')).toEqual([]);
  });

  it('counts an endpoint once when it carries multiple matching topics', () => {
    const repository = createRepository();

    repository.upsert({
      endpoint: 'https://push.example/1',
      p256dh: 'p256dh-1',
      auth: 'auth-1',
      userId: 'alice',
    });
    repository.rewriteTopics('https://push.example/1', ['media-users', 'media-admins']);

    expect(repository.endpointsForTopic('media-users')).toEqual(['https://push.example/1']);
    expect(repository.endpointsForTopic('media-users')).toHaveLength(1);
  });
});
