import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { TEST_VAPID_PUBLIC_KEY } from '../test-helpers/constants.js';
import { initConfig, resetConfigForTesting } from '../config/get-config.js';
import { openDatabase, resetDatabaseForTesting } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';

const ALERTS_CONFIG = `
adminGroup: system-admins
groups:
  - media-users
  - media-admins
applications:
  - id: media
    name: Media
    description: Films and series.
    url: https://media.example.com
    icon: media.svg
    groups: [media-users]
    services: []
`;

const ALLOWED_ORIGIN = 'https://dashboard.example.com';
const LOGOUT_URL = 'https://auth.example.com/logout';
const DOCKER_PROXY_URL = 'http://docker-proxy.example.com';

const regularUser = {
  user: 'alice',
  groups: ['media-users'],
  email: 'alice@example.com',
  name: 'Alice',
};

const adminUser = {
  user: 'admin',
  groups: ['system-admins', 'media-admins'],
  email: 'admin@example.com',
  name: 'Admin',
};

let tempDirectory: string | null = null;

function headersForUser(
  user: { user: string; groups: string[]; email: string; name: string } | null,
  options: { origin?: string; contentType?: string } = {},
): HeadersInit {
  if (!user) {
    return {
      Accept: 'application/json',
      ...(options.contentType ? { 'Content-Type': options.contentType } : {}),
    };
  }

  return {
    Accept: 'application/json',
    'Remote-User': user.user,
    'Remote-Groups': user.groups.join(','),
    'Remote-Email': user.email,
    'Remote-Name': user.name,
    ...(options.origin ? { Origin: options.origin } : {}),
    ...(options.contentType ? { 'Content-Type': options.contentType } : {}),
  };
}

function createTestApp() {
  return createApp({
    allowedOrigin: ALLOWED_ORIGIN,
    autheliaLogoutUrl: LOGOUT_URL,
    dockerProxyUrl: DOCKER_PROXY_URL,
    vapidPublicKey: TEST_VAPID_PUBLIC_KEY,
  });
}

async function setupEnvironment() {
  resetConfigForTesting();
  resetDatabaseForTesting();

  tempDirectory = mkdtempSync(join(tmpdir(), 'dashboard-alerts-'));
  const configPath = join(tempDirectory, 'dashboard.yaml');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(configPath, ALERTS_CONFIG, 'utf8');

  initConfig(configPath);
  const db = openDatabase(join(tempDirectory, 'dashboard.db'));
  runMigrations(db);

  return createTestApp();
}

afterEach(() => {
  resetConfigForTesting();
  resetDatabaseForTesting();
  if (tempDirectory) {
    rmSync(tempDirectory, { recursive: true, force: true });
    tempDirectory = null;
  }
});

describe('admin alerts API', () => {
  it('returns 401 for unauthenticated requests', async () => {
    const app = await setupEnvironment();

    const response = await app.request('/api/admin/alerts', {
      headers: headersForUser(null),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: 'unauthorized' });
  });

  it('returns 403 for authenticated non-admin users', async () => {
    const app = await setupEnvironment();

    const response = await app.request('/api/admin/alerts', {
      headers: headersForUser(regularUser),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: 'forbidden' });
  });

  it('creates an alert with created_by from Remote-User and ignores id/created_by in the body', async () => {
    const app = await setupEnvironment();

    const response = await app.request('/api/admin/alerts', {
      method: 'POST',
      headers: headersForUser(adminUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({
        id: 'client-id',
        created_by: 'impersonator',
        severity: 'warning',
        title: 'Storage maintenance',
        body: 'Backups may pause briefly.',
        topic: 'media-users',
        endsAt: '2026-12-31T23:59:59.000Z',
      }),
    });

    expect(response.status).toBe(201);
    const created = await response.json();
    expect(created.id).not.toBe('client-id');
    expect(created).toMatchObject({
      severity: 'warning',
      title: 'Storage maintenance',
      body: 'Backups may pause briefly.',
      topic: 'media-users',
      endsAt: '2026-12-31T23:59:59.000Z',
    });
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(created).not.toHaveProperty('createdBy');

    const db = openDatabase(join(tempDirectory!, 'dashboard.db'));
    const stored = db
      .prepare('SELECT id, created_by FROM alerts WHERE id = ?')
      .get(created.id) as { id: string; created_by: string };
    expect(stored.created_by).toBe('admin');
    expect(stored.id).toBe(created.id);
  });

  it('rejects invalid severity and topic without writing a row', async () => {
    const app = await setupEnvironment();

    const invalidSeverity = await app.request('/api/admin/alerts', {
      method: 'POST',
      headers: headersForUser(adminUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({
        severity: 'critical',
        title: 'Bad alert',
        body: null,
        topic: 'media-users',
        endsAt: null,
      }),
    });
    expect(invalidSeverity.status).toBe(400);

    const invalidTopic = await app.request('/api/admin/alerts', {
      method: 'POST',
      headers: headersForUser(adminUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({
        severity: 'info',
        title: 'Bad alert',
        body: null,
        topic: 'other-users',
        endsAt: null,
      }),
    });
    expect(invalidTopic.status).toBe(400);

    const listResponse = await app.request('/api/admin/alerts', {
      headers: headersForUser(adminUser),
    });
    expect(await listResponse.json()).toEqual([]);
  });

  it('lists all alerts including expired ones', async () => {
    const app = await setupEnvironment();
    const db = openDatabase(join(tempDirectory!, 'dashboard.db'));

    db.prepare(
      `INSERT INTO alerts (id, severity, title, body, topic, ends_at, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'expired-alert',
      'info',
      'Expired notice',
      null,
      'media-users',
      '2020-01-01T00:00:00.000Z',
      '2020-01-01T00:00:00.000Z',
      'admin',
    );

    const createResponse = await app.request('/api/admin/alerts', {
      method: 'POST',
      headers: headersForUser(adminUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({
        severity: 'success',
        title: 'Active notice',
        body: null,
        topic: '*',
        endsAt: '2099-01-01T00:00:00.000Z',
      }),
    });
    const active = await createResponse.json();

    const listResponse = await app.request('/api/admin/alerts', {
      headers: headersForUser(adminUser),
    });

    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual([
      active,
      {
        id: 'expired-alert',
        severity: 'info',
        title: 'Expired notice',
        body: null,
        topic: 'media-users',
        endsAt: '2020-01-01T00:00:00.000Z',
        createdAt: '2020-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('patches only the provided fields and leaves created_at/created_by untouched', async () => {
    const app = await setupEnvironment();

    const createResponse = await app.request('/api/admin/alerts', {
      method: 'POST',
      headers: headersForUser(adminUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({
        severity: 'info',
        title: 'Original title',
        body: 'Original body',
        topic: 'media-users',
        endsAt: '2026-06-01T00:00:00.000Z',
      }),
    });
    const created = await createResponse.json();

    const patchResponse = await app.request(`/api/admin/alerts/${created.id}`, {
      method: 'PATCH',
      headers: headersForUser(adminUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({
        endsAt: '2026-12-31T23:59:59.000Z',
      }),
    });

    expect(patchResponse.status).toBe(200);
    expect(await patchResponse.json()).toEqual({
      ...created,
      endsAt: '2026-12-31T23:59:59.000Z',
    });

    const db = openDatabase(join(tempDirectory!, 'dashboard.db'));
    const stored = db
      .prepare('SELECT created_at, created_by, title, body, topic, severity FROM alerts WHERE id = ?')
      .get(created.id) as {
      created_at: string;
      created_by: string;
      title: string;
      body: string;
      topic: string;
      severity: string;
    };
    expect(stored.created_at).toBe(created.createdAt);
    expect(stored.created_by).toBe('admin');
    expect(stored.title).toBe('Original title');
    expect(stored.body).toBe('Original body');
    expect(stored.topic).toBe('media-users');
    expect(stored.severity).toBe('info');
  });

  it('returns 404 for patch and delete on unknown ids', async () => {
    const app = await setupEnvironment();

    const patchResponse = await app.request('/api/admin/alerts/missing-id', {
      method: 'PATCH',
      headers: headersForUser(adminUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({ endsAt: null }),
    });
    expect(patchResponse.status).toBe(404);
    expect(await patchResponse.json()).toEqual({ code: 'not_found' });

    const deleteResponse = await app.request('/api/admin/alerts/missing-id', {
      method: 'DELETE',
      headers: headersForUser(adminUser, { origin: ALLOWED_ORIGIN }),
    });
    expect(deleteResponse.status).toBe(404);
    expect(await deleteResponse.json()).toEqual({ code: 'not_found' });
  });

  it('deletes an existing alert', async () => {
    const app = await setupEnvironment();

    const createResponse = await app.request('/api/admin/alerts', {
      method: 'POST',
      headers: headersForUser(adminUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({
        severity: 'error',
        title: 'Delete me',
        body: null,
        topic: 'media-admins',
        endsAt: null,
      }),
    });
    const created = await createResponse.json();

    const deleteResponse = await app.request(`/api/admin/alerts/${created.id}`, {
      method: 'DELETE',
      headers: headersForUser(adminUser, { origin: ALLOWED_ORIGIN }),
    });
    expect(deleteResponse.status).toBe(204);

    const listResponse = await app.request('/api/admin/alerts', {
      headers: headersForUser(adminUser),
    });
    expect(await listResponse.json()).toEqual([]);
  });

  it('does not send push notifications when creating an alert', async () => {
    const app = await setupEnvironment();
    const db = openDatabase(join(tempDirectory!, 'dashboard.db'));

    const response = await app.request('/api/admin/alerts', {
      method: 'POST',
      headers: headersForUser(adminUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({
        severity: 'info',
        title: 'No push',
        body: null,
        topic: '*',
        endsAt: null,
      }),
    });

    expect(response.status).toBe(201);

    const subscriptionCount = db
      .prepare('SELECT COUNT(*) as count FROM push_subscriptions')
      .get() as { count: number };
    expect(subscriptionCount.count).toBe(0);
  });
});
