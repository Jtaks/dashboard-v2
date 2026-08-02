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

const mediaUser = {
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
): HeadersInit {
  if (!user) {
    return { Accept: 'application/json' };
  }

  return {
    Accept: 'application/json',
    'Remote-User': user.user,
    'Remote-Groups': user.groups.join(','),
    'Remote-Email': user.email,
    'Remote-Name': user.name,
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

  tempDirectory = mkdtempSync(join(tmpdir(), 'dashboard-user-alerts-'));
  const configPath = join(tempDirectory, 'dashboard.yaml');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(configPath, ALERTS_CONFIG, 'utf8');

  initConfig(configPath);
  const db = openDatabase(join(tempDirectory, 'dashboard.db'));
  runMigrations(db);

  return createTestApp();
}

function seedAlert(
  db: ReturnType<typeof openDatabase>,
  alert: {
    id: string;
    severity: string;
    title: string;
    body: string | null;
    topic: string;
    endsAt: string | null;
    createdAt: string;
  },
) {
  db.prepare(
    `INSERT INTO alerts (id, severity, title, body, topic, ends_at, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    alert.id,
    alert.severity,
    alert.title,
    alert.body,
    alert.topic,
    alert.endsAt,
    alert.createdAt,
    'admin',
  );
}

afterEach(() => {
  resetConfigForTesting();
  resetDatabaseForTesting();
  if (tempDirectory) {
    rmSync(tempDirectory, { recursive: true, force: true });
    tempDirectory = null;
  }
});

describe('GET /api/alerts', () => {
  it('returns 401 for unauthenticated requests', async () => {
    const app = await setupEnvironment();

    const response = await app.request('/api/alerts', {
      headers: headersForUser(null),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: 'unauthorized' });
  });

  it('returns only active alerts targeted at the requesting user', async () => {
    const app = await setupEnvironment();
    const db = openDatabase(join(tempDirectory!, 'dashboard.db'));

    seedAlert(db, {
      id: 'media-alert',
      severity: 'warning',
      title: 'Media maintenance',
      body: 'Brief outage expected.',
      topic: 'media-users',
      endsAt: '2099-01-01T00:00:00.000Z',
      createdAt: '2026-06-01T10:00:00.000Z',
    });

    seedAlert(db, {
      id: 'admin-alert',
      severity: 'info',
      title: 'Admin notice',
      body: null,
      topic: 'media-admins',
      endsAt: null,
      createdAt: '2026-06-01T11:00:00.000Z',
    });

    seedAlert(db, {
      id: 'global-alert',
      severity: 'success',
      title: 'Welcome',
      body: null,
      topic: '*',
      endsAt: null,
      createdAt: '2026-06-01T12:00:00.000Z',
    });

    seedAlert(db, {
      id: 'expired-alert',
      severity: 'error',
      title: 'Expired notice',
      body: null,
      topic: 'media-users',
      endsAt: '2020-01-01T00:00:00.000Z',
      createdAt: '2020-01-01T00:00:00.000Z',
    });

    const mediaResponse = await app.request('/api/alerts', {
      headers: headersForUser(mediaUser),
    });
    expect(mediaResponse.status).toBe(200);
    const mediaAlerts = await mediaResponse.json();
    expect(mediaAlerts).toEqual([
      {
        id: 'global-alert',
        severity: 'success',
        title: 'Welcome',
        body: null,
        topic: '*',
        endsAt: null,
        createdAt: '2026-06-01T12:00:00.000Z',
      },
      {
        id: 'media-alert',
        severity: 'warning',
        title: 'Media maintenance',
        body: 'Brief outage expected.',
        topic: 'media-users',
        endsAt: '2099-01-01T00:00:00.000Z',
        createdAt: '2026-06-01T10:00:00.000Z',
      },
    ]);
    for (const alert of mediaAlerts) {
      expect(alert).not.toHaveProperty('createdBy');
      expect(alert).not.toHaveProperty('created_by');
    }

    const adminResponse = await app.request('/api/alerts', {
      headers: headersForUser(adminUser),
    });
    expect(adminResponse.status).toBe(200);
    const adminAlerts = await adminResponse.json();
    expect(adminAlerts).toEqual([
      {
        id: 'global-alert',
        severity: 'success',
        title: 'Welcome',
        body: null,
        topic: '*',
        endsAt: null,
        createdAt: '2026-06-01T12:00:00.000Z',
      },
      {
        id: 'admin-alert',
        severity: 'info',
        title: 'Admin notice',
        body: null,
        topic: 'media-admins',
        endsAt: null,
        createdAt: '2026-06-01T11:00:00.000Z',
      },
    ]);
  });

  it('reflects a changed Remote-Groups header without writing to the database', async () => {
    const app = await setupEnvironment();
    const db = openDatabase(join(tempDirectory!, 'dashboard.db'));

    seedAlert(db, {
      id: 'media-alert',
      severity: 'info',
      title: 'Media only',
      body: null,
      topic: 'media-users',
      endsAt: null,
      createdAt: '2026-06-01T10:00:00.000Z',
    });

    seedAlert(db, {
      id: 'admin-alert',
      severity: 'info',
      title: 'Admin only',
      body: null,
      topic: 'media-admins',
      endsAt: null,
      createdAt: '2026-06-01T11:00:00.000Z',
    });

    const asMediaUser = await app.request('/api/alerts', {
      headers: headersForUser(mediaUser),
    });
    expect(await asMediaUser.json()).toEqual([
      {
        id: 'media-alert',
        severity: 'info',
        title: 'Media only',
        body: null,
        topic: 'media-users',
        endsAt: null,
        createdAt: '2026-06-01T10:00:00.000Z',
      },
    ]);

    const asAdminUser = await app.request('/api/alerts', {
      headers: headersForUser(adminUser),
    });
    expect(await asAdminUser.json()).toEqual([
      {
        id: 'admin-alert',
        severity: 'info',
        title: 'Admin only',
        body: null,
        topic: 'media-admins',
        endsAt: null,
        createdAt: '2026-06-01T11:00:00.000Z',
      },
    ]);

    const rowCount = db.prepare('SELECT COUNT(*) as count FROM alerts').get() as { count: number };
    expect(rowCount.count).toBe(2);
  });
});
