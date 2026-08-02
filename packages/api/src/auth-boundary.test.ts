import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';
import { initConfig, resetConfigForTesting } from './config/get-config.js';
import { openDatabase, resetDatabaseForTesting } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { createAlertsRepository } from './alerts/alerts-repository.js';
import { createPushSubscriptionsRepository } from './push/push-subscriptions-repository.js';
import { TEST_VAPID_PUBLIC_KEY } from './test-helpers/constants.js';
import {
  enumerateApiRoutes,
  instantiatePath,
} from './test-helpers/enumerate-routes.js';
import { headersForUser } from './test-helpers/request-headers.js';
import { snapshotDatabase } from './test-helpers/snapshot-database.js';
import {
  STATE_CHANGING_METHODS,
  TDD_API_SURFACE,
} from './test-helpers/tdd-api-surface.js';

const sendNotification = vi.hoisted(() => vi.fn());

vi.mock('web-push', () => ({
  default: {
    sendNotification,
    setVapidDetails: vi.fn(),
  },
}));

import webpush from 'web-push';

const BOUNDARY_CONFIG = `
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
    services:
      - id: jellyfin
        name: Jellyfin
        containers: [jellyfin-container]
`;

const ALLOWED_ORIGIN = 'https://dashboard.example.com';
const FOREIGN_ORIGIN = 'https://evil.example.com';
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

const PUSH_ENDPOINT = 'https://push.example/boundary-subscription';
const ALERT_ID = 'boundary-alert-id';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CADDYFILE_FRAGMENT = join(REPO_ROOT, 'deploy', 'Caddyfile.fragment');
const INTEGRATOR_DOC = join(REPO_ROOT, 'deploy', 'INTEGRATOR.md');

let tempDirectory: string | null = null;

function createTestApp() {
  return createApp({
    allowedOrigin: ALLOWED_ORIGIN,
    autheliaLogoutUrl: LOGOUT_URL,
    dockerProxyUrl: DOCKER_PROXY_URL,
    vapidPublicKey: TEST_VAPID_PUBLIC_KEY,
  });
}

function setupEnvironment() {
  resetConfigForTesting();
  resetDatabaseForTesting();
  vi.mocked(webpush.sendNotification).mockReset();

  tempDirectory = mkdtempSync(join(tmpdir(), 'dashboard-auth-boundary-'));
  const configPath = join(tempDirectory, 'dashboard.yaml');
  writeFileSync(configPath, BOUNDARY_CONFIG, 'utf8');

  initConfig(configPath);
  const db = openDatabase(join(tempDirectory, 'dashboard.db'));
  runMigrations(db);

  return { app: createTestApp(), db };
}

function seedPushSubscription(db: ReturnType<typeof openDatabase>) {
  const repository = createPushSubscriptionsRepository(db);
  repository.upsert({
    endpoint: PUSH_ENDPOINT,
    p256dh: 'p256dh-boundary',
    auth: 'auth-boundary',
    userId: regularUser.user,
  });
  repository.rewriteTopics(PUSH_ENDPOINT, ['media-users']);
}

function seedAlert(db: ReturnType<typeof openDatabase>) {
  const repository = createAlertsRepository(db);
  repository.insert(
    {
      severity: 'info',
      title: 'Boundary alert',
      body: null,
      topic: 'media-users',
      endsAt: null,
    },
    adminUser.user,
  );
  const row = db
    .prepare('SELECT id FROM alerts WHERE title = ?')
    .get('Boundary alert') as { id: string };
  return row.id;
}

function adminClaimExtras(): Record<string, string> {
  return {
    'X-Admin': 'true',
    'Remote-Groups': 'system-admins',
    'X-Impersonate-Admin': 'system-admins',
  };
}

function bodyForRoute(method: string, path: string, alertId = ALERT_ID): string | undefined {
  if (!STATE_CHANGING_METHODS.has(method)) {
    return undefined;
  }

  if (path === '/api/push/subscriptions' && method === 'POST') {
    return JSON.stringify({
      endpoint: PUSH_ENDPOINT,
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    });
  }

  if (path === '/api/push/subscriptions' && method === 'DELETE') {
    return JSON.stringify({ endpoint: PUSH_ENDPOINT });
  }

  if (path === '/api/admin/alerts' && method === 'POST') {
    return JSON.stringify({
      admin: true,
      severity: 'warning',
      title: 'Auth boundary alert',
      body: 'Should not persist on refusal.',
      topic: 'media-users',
      endsAt: null,
    });
  }

  if (path === '/api/admin/alerts/:id' && method === 'PATCH') {
    return JSON.stringify({
      admin: true,
      title: 'Updated by boundary test',
    });
  }

  if (path === '/api/admin/push' && method === 'POST') {
    return JSON.stringify({
      admin: true,
      title: 'Boundary push',
      body: 'Should not send on refusal.',
      url: null,
      topic: '*',
    });
  }

  if (path === '/api/admin/alerts/:id' && method === 'DELETE') {
    return undefined;
  }

  return JSON.stringify({ admin: true });
}

function userForRoute(path: string) {
  return path.startsWith('/api/admin/') ? adminUser : regularUser;
}

function prepareDatabaseForRoute(
  db: ReturnType<typeof openDatabase>,
  method: string,
  path: string,
): string {
  if (path === '/api/push/subscriptions' && method === 'DELETE') {
    seedPushSubscription(db);
  }

  if (path === '/api/admin/alerts/:id' && (method === 'PATCH' || method === 'DELETE')) {
    return seedAlert(db);
  }

  if (path === '/api/admin/push' && method === 'POST') {
    seedPushSubscription(db);
  }

  return ALERT_ID;
}

beforeEach(() => {
  setupEnvironment();
});

afterEach(() => {
  resetConfigForTesting();
  resetDatabaseForTesting();
  if (tempDirectory) {
    rmSync(tempDirectory, { recursive: true, force: true });
    tempDirectory = null;
  }
});

describe('auth boundary', () => {
  it('enumerates every registered /api route from the router', () => {
    const { app } = setupEnvironment();
    const routes = enumerateApiRoutes(app);

    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((route) => route.path.startsWith('/api'))).toBe(true);
  });

  it('matches the router enumeration to the TDD API surface', () => {
    const { app } = setupEnvironment();
    const routes = enumerateApiRoutes(app);
    const routerKeys = new Set(routes.map((route) => `${route.method} ${route.path}`));
    const tddKeys = new Set(TDD_API_SURFACE.map((route) => `${route.method} ${route.path}`));

    expect(routerKeys).toEqual(tddKeys);
  });

  it('refuses every /api route that carries no Remote-* headers', async () => {
    const { app } = setupEnvironment();
    const routes = enumerateApiRoutes(app);

    for (const route of routes) {
      const path = instantiatePath(route.path);
      const response = await app.request(path, {
        method: route.method,
        headers: { Accept: 'application/json' },
        body: bodyForRoute(route.method, route.path),
      });

      expect(response.status, `${route.method} ${path}`).toBe(401);
      expect(await response.json()).toEqual({ code: 'unauthorized' });
    }
  });

  it('refuses identity when Remote-User is absent', async () => {
    const { app } = setupEnvironment();

    const response = await app.request('/api/session', {
      headers: {
        Accept: 'application/json',
        'Remote-Groups': 'media-users',
        'Remote-Email': regularUser.email,
        'Remote-Name': regularUser.name,
      },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: 'unauthorized' });
  });

  it('refuses identity when Remote-Groups is absent', async () => {
    const { app } = setupEnvironment();

    const response = await app.request('/api/session', {
      headers: {
        Accept: 'application/json',
        'Remote-User': regularUser.user,
        'Remote-Email': regularUser.email,
        'Remote-Name': regularUser.name,
      },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: 'unauthorized' });
  });

  it('refuses identity when Remote-Groups is present but empty', async () => {
    const { app } = setupEnvironment();

    const response = await app.request('/api/session', {
      headers: {
        Accept: 'application/json',
        'Remote-User': regularUser.user,
        'Remote-Groups': '',
        'Remote-Email': regularUser.email,
        'Remote-Name': regularUser.name,
      },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: 'unauthorized' });
  });

  it('returns 403 for every admin route when Remote-Groups excludes adminGroup', async () => {
    const { app } = setupEnvironment();
    const adminRoutes = enumerateApiRoutes(app).filter((route) =>
      route.path.startsWith('/api/admin/'),
    );

    for (const route of adminRoutes) {
      const path = instantiatePath(route.path);
      const response = await app.request(path, {
        method: route.method,
        headers: headersForUser(regularUser, {
          origin: ALLOWED_ORIGIN,
          contentType: 'application/json',
          extra: adminClaimExtras(),
        }),
        body: bodyForRoute(route.method, route.path),
      });

      expect(response.status, `${route.method} ${path}`).toBe(403);
      expect(await response.json()).toEqual({ code: 'forbidden' });
    }
  });

  it('leaves SQLite unchanged when a state-changing write is refused for origin mismatch', async () => {
    const { app, db } = setupEnvironment();
    const stateChangingRoutes = enumerateApiRoutes(app).filter((route) =>
      STATE_CHANGING_METHODS.has(route.method),
    );

    for (const route of stateChangingRoutes) {
      const alertId = prepareDatabaseForRoute(db, route.method, route.path);
      const path = instantiatePath(route.path, { id: alertId });
      const before = snapshotDatabase(db);
      const user = userForRoute(route.path);

      const refused = await app.request(path, {
        method: route.method,
        headers: headersForUser(user, {
          origin: FOREIGN_ORIGIN,
          contentType: 'application/json',
        }),
        body: bodyForRoute(route.method, route.path, alertId),
      });

      expect(refused.status, `${route.method} ${path} foreign origin`).toBe(403);
      expect(await refused.json()).toEqual({ code: 'origin_mismatch' });
      expect(snapshotDatabase(db), `${route.method} ${path} foreign origin db`).toBe(before);

      const absent = await app.request(path, {
        method: route.method,
        headers: headersForUser(user, {
          contentType: 'application/json',
        }),
        body: bodyForRoute(route.method, route.path, alertId),
      });

      expect(absent.status, `${route.method} ${path} absent origin`).toBe(403);
      expect(await absent.json()).toEqual({ code: 'origin_mismatch' });
      expect(snapshotDatabase(db), `${route.method} ${path} absent origin db`).toBe(before);
    }
  });

  it('allows state-changing writes from ALLOWED_ORIGIN and changes SQLite when the handler writes', async () => {
    const { app, db } = setupEnvironment();

    const postSubscription = await app.request('/api/push/subscriptions', {
      method: 'POST',
      headers: headersForUser(regularUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({
        endpoint: PUSH_ENDPOINT,
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      }),
    });
    expect(postSubscription.status).toBe(204);

    const subscriptionCount = db
      .prepare('SELECT COUNT(*) as count FROM push_subscriptions')
      .get() as { count: number };
    expect(subscriptionCount.count).toBe(1);

    const createAlert = await app.request('/api/admin/alerts', {
      method: 'POST',
      headers: headersForUser(adminUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({
        severity: 'info',
        title: 'Allowed origin alert',
        body: null,
        topic: 'media-users',
        endsAt: null,
      }),
    });
    expect(createAlert.status).toBe(201);
    const created = (await createAlert.json()) as { id: string };

    const patchAlert = await app.request(`/api/admin/alerts/${created.id}`, {
      method: 'PATCH',
      headers: headersForUser(adminUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({ title: 'Allowed origin patch' }),
    });
    expect(patchAlert.status).toBe(200);

    vi.mocked(webpush.sendNotification).mockResolvedValue({} as never);

    const push = await app.request('/api/admin/push', {
      method: 'POST',
      headers: headersForUser(adminUser, {
        origin: ALLOWED_ORIGIN,
        contentType: 'application/json',
      }),
      body: JSON.stringify({
        title: 'Allowed origin push',
        body: 'Sent',
        url: null,
        topic: 'media-users',
      }),
    });
    expect(push.status).toBe(200);
    expect(vi.mocked(webpush.sendNotification)).toHaveBeenCalled();
  });

  it('does not require authentication for non-/api paths on the API service', async () => {
    const { app } = setupEnvironment();
    const nonApiPaths = ['/', '/settings', '/admin', '/apps/media'];

    for (const path of nonApiPaths) {
      const response = await app.request(path, {
        headers: { Accept: 'application/json' },
      });

      expect(response.status, path).not.toBe(401);
      expect(response.status, path).toBe(404);
      expect(await response.json()).toEqual({ code: 'not_found' });
    }
  });

  it('documents unauthenticated client routing for non-/api paths in the A7 deployment fragment', () => {
    const caddyfile = readFileSync(CADDYFILE_FRAGMENT, 'utf8');
    const integrator = readFileSync(INTEGRATOR_DOC, 'utf8');

    expect(caddyfile).toMatch(/@dashboard_api\s+path\s+\/api\/\*/);
    expect(caddyfile).toMatch(/forward_auth\s+authelia:9091/);
    expect(caddyfile).toMatch(/reverse_proxy\s+dashboard-api:3000/);
    expect(caddyfile).toMatch(/reverse_proxy\s+dashboard-client:80/);
    expect(integrator).toMatch(/All other paths are served by `dashboard-client`/);
    expect(integrator).toMatch(/`\/` serves the static client without authentication/);

    const apiBlock = caddyfile.split('# Everything else')[0];
    expect(apiBlock.includes('forward_auth')).toBe(true);

    const clientBlock = caddyfile.split('# Everything else')[1] ?? '';
    expect(clientBlock.includes('forward_auth')).toBe(false);
  });
});
