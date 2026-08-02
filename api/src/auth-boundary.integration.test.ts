import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';
import { loadConfig, resetConfigForTests, type ResolvedConfig } from './config.js';
import { ensureDatabase, getDb, resetDatabaseForTests } from './db/index.js';
import { ErrorCodes } from './errors.js';
import type { RuntimeEnv } from './env.js';
import { createLogger } from './logging.js';
import { insertAlert } from './alerts/index.js';
import { upsertSubscription, rewriteTopics } from './push/repository.js';
import type { AppVariables } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures');
const repoRoot = join(here, '..', '..');
const caddyFragmentPath = join(repoRoot, 'deploy', 'Caddyfile.fragment');

const TEST_PUBLIC_KEY =
  'BBvAqccKn9JVUDVBF0i4Xwvx0Rm39fzxQIgTZSl6-ItXsv4zaHoYOPKHeSd4mKBeojpKDB2Kgamft7UYb5SSoBs';

const testEnv: RuntimeEnv = {
  port: 3000,
  logLevel: 'error',
  allowedOrigin: 'https://dashboard.example.com',
  autheliaLogoutUrl: 'https://auth.example.com/logout',
  dockerProxyUrl: undefined,
};

const STATE_CHANGING = new Set(['POST', 'PATCH', 'DELETE']);

/**
 * Admin column from TDD - API surface. Used only to cross-check the router;
 * the suite never drives cases from a hand-maintained full route list.
 */
const TDD_ADMIN_ROUTES: ReadonlyArray<{ method: string; path: string }> = [
  { method: 'GET', path: '/api/admin/topics' },
  { method: 'GET', path: '/api/admin/alerts' },
  { method: 'POST', path: '/api/admin/alerts' },
  { method: 'PATCH', path: '/api/admin/alerts/:id' },
  { method: 'DELETE', path: '/api/admin/alerts/:id' },
  { method: 'POST', path: '/api/admin/push' },
];

type RegisteredRoute = { method: string; path: string };

/** Concrete HTTP handlers registered on the app (excludes middleware `ALL`). */
function listRegisteredRoutes(app: Hono<{ Variables: AppVariables }>): RegisteredRoute[] {
  return app.routes
    .filter((r) => r.method !== 'ALL')
    .map((r) => ({ method: r.method, path: r.path }));
}

function routeKey(r: { method: string; path: string }): string {
  return `${r.method} ${r.path}`;
}

function concretePath(path: string, id = 'probe-id'): string {
  return path.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, id);
}

function isAdminRoute(path: string): boolean {
  return path === '/api/admin' || path.startsWith('/api/admin/');
}

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dashboard-auth-boundary-'));
  return join(dir, 'dashboard.db');
}

function cleanupDbPath(path: string): void {
  rmSync(dirname(path), { recursive: true, force: true });
}

function remoteHeaders(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    'Remote-User': 'alice',
    'Remote-Groups': 'media-users',
    'Remote-Email': 'alice@example.com',
    'Remote-Name': 'Alice Example',
    ...overrides,
  };
}

/** Client-controlled claims that must not elevate a non-admin. */
function claimAdminExtras(): {
  headers: Record<string, string>;
  query: string;
  body: Record<string, unknown>;
} {
  return {
    headers: {
      'X-Admin': 'true',
      'X-Role': 'admin',
      'X-Remote-Groups': 'system-admins',
      Authorization: 'Bearer admin-token',
    },
    query: '?admin=true&role=admin&groups=system-admins',
    body: {
      admin: true,
      role: 'admin',
      groups: ['system-admins'],
      'Remote-Groups': 'system-admins',
    },
  };
}

function dbFingerprint(): string {
  const db = getDb();
  return JSON.stringify({
    alerts: db.prepare(`SELECT * FROM alerts ORDER BY id`).all(),
    push_subscriptions: db.prepare(`SELECT * FROM push_subscriptions ORDER BY endpoint`).all(),
    push_subscription_topics: db
      .prepare(`SELECT * FROM push_subscription_topics ORDER BY endpoint, topic`)
      .all(),
  });
}

function writeBodyFor(route: RegisteredRoute): string | undefined {
  if (route.method === 'GET') {
    return undefined;
  }
  if (route.path === '/api/push/subscriptions' && route.method === 'POST') {
    return JSON.stringify({
      endpoint: 'https://push.example/boundary-device',
      keys: { p256dh: 'p256dh-boundary', auth: 'auth-boundary' },
    });
  }
  if (route.path === '/api/push/subscriptions' && route.method === 'DELETE') {
    return JSON.stringify({ endpoint: 'https://push.example/boundary-device' });
  }
  if (route.path === '/api/admin/alerts' && route.method === 'POST') {
    return JSON.stringify({
      severity: 'info',
      title: 'Boundary create',
      body: null,
      topic: 'media-users',
      endsAt: null,
    });
  }
  if (route.path === '/api/admin/alerts/:id' && route.method === 'PATCH') {
    return JSON.stringify({ title: 'Boundary patched' });
  }
  if (route.path === '/api/admin/push' && route.method === 'POST') {
    return JSON.stringify({
      title: 'Boundary push',
      body: 'hello',
      url: null,
      topic: 'media-users',
    });
  }
  if (route.method === 'DELETE') {
    return undefined;
  }
  return JSON.stringify({});
}

describe('G1 auth boundary', () => {
  let config: ResolvedConfig;
  let dbPath: string;
  let app: Hono<{ Variables: AppVariables }>;
  let routes: RegisteredRoute[];

  beforeEach(() => {
    resetConfigForTests();
    resetDatabaseForTests();
    config = loadConfig(join(fixturesDir, 'valid.yaml'));
    dbPath = tempDbPath();
    ensureDatabase(dbPath);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    app = createApp({
      config,
      env: testEnv,
      logger: createLogger('error'),
      vapidPublicKey: TEST_PUBLIC_KEY,
      adminPush: {
        send: async () => {
          /* no-op sender for ALLOWED_ORIGIN success on admin push */
        },
      },
    });
    routes = listRegisteredRoutes(app);
  });

  afterEach(() => {
    resetDatabaseForTests();
    cleanupDbPath(dbPath);
    resetConfigForTests();
    vi.restoreAllMocks();
  });

  it('enumerates concrete handlers from the Hono router (not a literal route list)', () => {
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((r) => r.path.startsWith('/api'))).toBe(true);
    expect(routes.some((r) => r.method === 'ALL')).toBe(false);
    // Sanity: middleware mount paths must not appear as concrete handlers.
    expect(routes.map(routeKey)).not.toContain('ALL /api/*');
  });

  it('refuses every registered /api route when Remote-* headers are absent', async () => {
    expect(routes.length).toBeGreaterThan(0);

    for (const route of routes) {
      const path = concretePath(route.path);
      const init: RequestInit = { method: route.method };
      const body = writeBodyFor(route);
      if (body !== undefined) {
        init.headers = {
          Origin: testEnv.allowedOrigin,
          'Content-Type': 'application/json',
        };
        init.body = body;
      } else if (STATE_CHANGING.has(route.method)) {
        init.headers = { Origin: testEnv.allowedOrigin };
      }

      const res = await app.request(path, init);
      expect(res.status, `${route.method} ${route.path}`).toBe(401);
      expect(await res.json(), `${route.method} ${route.path}`).toEqual({
        code: ErrorCodes.unauthorized,
      });
    }
  });

  it('cross-checks /api/admin routes against the TDD admin column', () => {
    const adminFromRouter = routes.filter((r) => isAdminRoute(r.path));
    const fromRouter = new Set(adminFromRouter.map(routeKey));
    const fromTdd = new Set(TDD_ADMIN_ROUTES.map(routeKey));

    expect(fromRouter).toEqual(fromTdd);
  });

  it('answers 403 in the shared error shape for every admin route as a non-admin, even when the client claims admin', async () => {
    const adminRoutes = routes.filter((r) => isAdminRoute(r.path));
    expect(adminRoutes.map(routeKey).sort()).toEqual([...TDD_ADMIN_ROUTES].map(routeKey).sort());

    const claim = claimAdminExtras();
    const seeded = insertAlert(getDb(), {
      severity: 'info',
      title: 'Seed',
      body: null,
      topic: 'media-users',
      endsAt: null,
      createdBy: 'seeder',
    });

    for (const route of adminRoutes) {
      const path = concretePath(route.path, seeded.id) + claim.query;
      const headers: Record<string, string> = {
        ...remoteHeaders({ 'Remote-Groups': 'media-users' }),
        ...claim.headers,
      };
      const init: RequestInit = { method: route.method, headers };
      const body = writeBodyFor(route);
      if (body !== undefined) {
        headers.Origin = testEnv.allowedOrigin;
        headers['Content-Type'] = 'application/json';
        // Merge claim body into a valid write payload so elevation cannot sneak in via body.
        init.body = JSON.stringify({ ...JSON.parse(body), ...claim.body });
      } else if (STATE_CHANGING.has(route.method)) {
        headers.Origin = testEnv.allowedOrigin;
      }

      const res = await app.request(path, init);
      expect(res.status, `${route.method} ${route.path}`).toBe(403);
      expect(await res.json(), `${route.method} ${route.path}`).toEqual({
        code: ErrorCodes.forbidden,
      });
    }
  });

  describe('fail-closed identity', () => {
    const probePath = '/api/session';

    it('refuses when Remote-User is absent (other Remote-* present)', async () => {
      const headers = remoteHeaders();
      delete headers['Remote-User'];

      const res = await app.request(probePath, { headers });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ code: ErrorCodes.unauthorized });
    });

    it('refuses when Remote-Groups is absent', async () => {
      const headers = remoteHeaders();
      delete headers['Remote-Groups'];

      const res = await app.request(probePath, { headers });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ code: ErrorCodes.unauthorized });
    });

    it('refuses when Remote-Groups is present but empty', async () => {
      for (const groups of ['', ' ', ' , ', ',']) {
        const res = await app.request(probePath, {
          headers: remoteHeaders({ 'Remote-Groups': groups }),
        });
        expect(res.status, `groups=${JSON.stringify(groups)}`).toBe(401);
        expect(await res.json()).toEqual({ code: ErrorCodes.unauthorized });
      }
    });

    it('fail-closed cases refuse every registered route, not a reduced view', async () => {
      const cases: Array<{ label: string; headers: Record<string, string> }> = [
        {
          label: 'no Remote-User',
          headers: (() => {
            const h = remoteHeaders();
            delete h['Remote-User'];
            return h;
          })(),
        },
        {
          label: 'no Remote-Groups',
          headers: (() => {
            const h = remoteHeaders();
            delete h['Remote-Groups'];
            return h;
          })(),
        },
        {
          label: 'empty Remote-Groups',
          headers: remoteHeaders({ 'Remote-Groups': '' }),
        },
      ];

      for (const { label, headers } of cases) {
        for (const route of routes) {
          const path = concretePath(route.path);
          const init: RequestInit = { method: route.method, headers: { ...headers } };
          const body = writeBodyFor(route);
          if (body !== undefined) {
            init.headers = {
              ...headers,
              Origin: testEnv.allowedOrigin,
              'Content-Type': 'application/json',
            };
            init.body = body;
          } else if (STATE_CHANGING.has(route.method)) {
            init.headers = { ...headers, Origin: testEnv.allowedOrigin };
          }

          const res = await app.request(path, init);
          expect(res.status, `${label} ${route.method} ${route.path}`).toBe(401);
          expect(await res.json()).toEqual({ code: ErrorCodes.unauthorized });
        }
      }
    });
  });

  describe('origin checks on state-changing routes', () => {
    function stateChangingRoutes(): RegisteredRoute[] {
      return routes.filter((r) => STATE_CHANGING.has(r.method));
    }

    function seedFor(route: RegisteredRoute): string {
      if (route.path === '/api/push/subscriptions') {
        const db = getDb();
        upsertSubscription(
          db,
          {
            endpoint: 'https://push.example/boundary-device',
            p256dh: 'p256dh-boundary',
            auth: 'auth-boundary',
            userId: 'alice',
          },
          () => new Date('2026-01-01T00:00:00.000Z'),
        );
        rewriteTopics(db, 'https://push.example/boundary-device', ['media-users']);
        return 'probe-id';
      }
      if (route.path.startsWith('/api/admin/alerts')) {
        const alert = insertAlert(getDb(), {
          severity: 'warning',
          title: 'Boundary seed',
          body: 'keep',
          topic: 'media-users',
          endsAt: null,
          createdBy: 'seeder',
        });
        return alert.id;
      }
      return 'probe-id';
    }

    function adminHeaders(): Record<string, string> {
      return remoteHeaders({ 'Remote-Groups': 'system-admins' });
    }

    function identityFor(route: RegisteredRoute): Record<string, string> {
      return isAdminRoute(route.path) ? adminHeaders() : remoteHeaders();
    }

    it('enumerates state-changing methods from the router', () => {
      const changing = stateChangingRoutes();
      expect(changing.length).toBeGreaterThan(0);
      expect(changing.every((r) => STATE_CHANGING.has(r.method))).toBe(true);
      expect(changing.map(routeKey).sort()).toEqual(
        [
          'POST /api/push/subscriptions',
          'DELETE /api/push/subscriptions',
          'POST /api/admin/alerts',
          'PATCH /api/admin/alerts/:id',
          'DELETE /api/admin/alerts/:id',
          'POST /api/admin/push',
        ].sort(),
      );
    });

    it('refuses a foreign Origin and leaves SQLite unchanged; ALLOWED_ORIGIN succeeds', async () => {
      for (const route of stateChangingRoutes()) {
        resetDatabaseForTests();
        ensureDatabase(dbPath);

        const id = seedFor(route);
        const before = dbFingerprint();
        const path = concretePath(route.path, id);
        const body = writeBodyFor(route);
        const baseHeaders = identityFor(route);

        const foreign = await app.request(path, {
          method: route.method,
          headers: {
            ...baseHeaders,
            Origin: 'https://evil.example.com',
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body,
        });
        expect(foreign.status, `foreign ${routeKey(route)}`).toBe(403);
        expect(await foreign.json()).toEqual({ code: ErrorCodes.invalidOrigin });
        expect(dbFingerprint(), `foreign ${routeKey(route)}`).toBe(before);

        const absent = await app.request(path, {
          method: route.method,
          headers: {
            ...baseHeaders,
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body,
        });
        expect(absent.status, `absent ${routeKey(route)}`).toBe(403);
        expect(await absent.json()).toEqual({ code: ErrorCodes.invalidOrigin });
        expect(dbFingerprint(), `absent ${routeKey(route)}`).toBe(before);

        const allowed = await app.request(path, {
          method: route.method,
          headers: {
            ...baseHeaders,
            Origin: testEnv.allowedOrigin,
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body,
        });
        expect(allowed.status, `allowed ${routeKey(route)} → ${allowed.status}`).toBeLessThan(400);
        // Writes that mutate must differ; admin push with empty audience may not.
        if (route.path !== '/api/admin/push') {
          expect(dbFingerprint(), `allowed ${routeKey(route)}`).not.toBe(before);
        }
      }
    });
  });

  describe('A7 deployment negative half (non-/api unauthenticated)', () => {
    it('asserts the Caddyfile fragment serves non-/api without forward_auth', () => {
      const fragment = readFileSync(caddyFragmentPath, 'utf8');

      expect(fragment).toMatch(/@dashboard_api\s+path\s+\/api\s+\/api\/\*/);
      expect(fragment).toMatch(/forward_auth\s+authelia:9091/);

      const handleBlocks = [...fragment.matchAll(/handle(\s+@\w+)?\s*\{([\s\S]*?)\n\}/g)];
      expect(handleBlocks.length).toBeGreaterThanOrEqual(2);

      const apiBlock = handleBlocks.find((m) => (m[1] ?? '').includes('@dashboard_api'));
      expect(apiBlock?.[2]).toMatch(/forward_auth/);
      expect(apiBlock?.[2]).toMatch(/reverse_proxy\s+dashboard-api/);

      const catchAll = handleBlocks.find((m) => !m[1]);
      expect(catchAll).toBeDefined();
      expect(catchAll?.[2]).not.toMatch(/forward_auth/);
      expect(catchAll?.[2]).toMatch(/reverse_proxy\s+dashboard-client/);
    });
  });
});
