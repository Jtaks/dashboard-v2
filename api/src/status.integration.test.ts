import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Catalog, StatusReport } from '@dashboard/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';
import { loadConfig, resetConfigForTests, type ResolvedConfig } from './config.js';
import type { RuntimeEnv } from './env.js';
import { ErrorCodes } from './errors.js';
import { createLogger } from './logging.js';
import { STATUS_CACHE_TTL_MS } from './status/cache.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

type ListItem = {
  Id: string;
  Names: string[];
  State: string;
  Status: string;
  Health?: { Status: string };
  StartedAt?: string;
};

function remoteHeaders(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    'Remote-User': 'alice',
    'Remote-Groups': 'media-users',
    'Remote-Email': 'alice@example.com',
    'Remote-Name': 'Alice Example',
    ...overrides,
  };
}

async function listen(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<{
  server: Server;
  baseUrl: string;
}> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  if (addr === null || typeof addr === 'string') {
    throw new Error('expected TCP address');
  }
  return { server, baseUrl: `http://127.0.0.1:${addr.port}` };
}

describe('GET /api/status', () => {
  let config: ResolvedConfig;
  const servers: Server[] = [];

  beforeEach(() => {
    resetConfigForTests();
    config = loadConfig(join(fixturesDir, 'catalog.yaml'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    resetConfigForTests();
    vi.restoreAllMocks();
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
          }),
      ),
    );
  });

  function envWith(dockerProxyUrl: string | undefined): RuntimeEnv {
    return {
      port: 3000,
      logLevel: 'error',
      allowedOrigin: 'https://dashboard.example.com',
      autheliaLogoutUrl: 'https://auth.example.com/logout',
      dockerProxyUrl,
    };
  }

  async function startProxy(
    items: ListItem[],
  ): Promise<{ baseUrl: string; listCalls: () => number }> {
    let listCalls = 0;
    const { server, baseUrl } = await listen((req, res) => {
      if (req.method === 'GET' && req.url?.startsWith('/containers/json')) {
        listCalls += 1;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(items));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    servers.push(server);
    return { baseUrl, listCalls: () => listCalls };
  }

  const healthyItems: ListItem[] = [
    {
      Id: '1',
      Names: ['/jellyfin'],
      State: 'running',
      Status: 'Up 2 hours',
      StartedAt: '2024-01-01T10:00:00.000Z',
    },
    {
      Id: '2',
      Names: ['/jellyfin-db'],
      State: 'exited',
      Status: 'Exited (0) 1 hour ago',
      StartedAt: '2024-01-01T11:00:00.000Z',
    },
    {
      Id: '3',
      Names: ['/wiki'],
      State: 'running',
      Status: 'Up 3 hours',
      StartedAt: '2024-01-01T09:00:00.000Z',
    },
  ];

  it('answers 401 and never reaches collection when identity is missing', async () => {
    const { baseUrl, listCalls } = await startProxy(healthyItems);
    const app = createApp({
      config,
      env: envWith(baseUrl),
      logger: createLogger('error'),
    });

    const res = await app.request('/api/status');

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: ErrorCodes.unauthorized });
    expect(listCalls()).toBe(0);
  });

  it('returns a non-admin subset whose ids match GET /api/catalog', async () => {
    const { baseUrl } = await startProxy(healthyItems);
    const app = createApp({
      config,
      env: envWith(baseUrl),
      logger: createLogger('error'),
    });
    const headers = remoteHeaders({ 'Remote-Groups': 'media-users' });

    const [statusRes, catalogRes] = await Promise.all([
      app.request('/api/status', { headers }),
      app.request('/api/catalog', { headers }),
    ]);

    expect(statusRes.status).toBe(200);
    expect(catalogRes.status).toBe(200);

    const status = (await statusRes.json()) as StatusReport;
    const catalog = (await catalogRes.json()) as Catalog;

    expect(status.applications.map((a) => a.id)).toEqual(catalog.applications.map((a) => a.id));
    expect(status.applications[0]?.services.map((s) => s.id)).toEqual(
      catalog.applications[0]?.services.map((s) => s.id),
    );
    expect(status.applications.map((a) => a.id)).toEqual(['media']);
    expect(status.applications[0]?.services.map((s) => s.id)).toEqual(['jellyfin', 'docs-link']);
  });

  it('omits an invisible service and excludes it from the application aggregate', async () => {
    const { baseUrl } = await startProxy(healthyItems);
    const app = createApp({
      config,
      env: envWith(baseUrl),
      logger: createLogger('error'),
    });

    const res = await app.request('/api/status', {
      headers: remoteHeaders({ 'Remote-Groups': 'media-users' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as StatusReport;
    const media = body.applications[0];

    expect(media?.services.find((s) => s.id === 'db')).toBeUndefined();
    // jellyfin is up; db is down but invisible — aggregate must not be down.
    expect(media?.status).toBe('up');
    expect(JSON.stringify(body)).not.toContain('"db"');
  });

  it('returns every application and service for an admin', async () => {
    const { baseUrl } = await startProxy(healthyItems);
    const app = createApp({
      config,
      env: envWith(baseUrl),
      logger: createLogger('error'),
    });
    const headers = remoteHeaders({ 'Remote-Groups': 'system-admins' });

    const [statusRes, catalogRes] = await Promise.all([
      app.request('/api/status', { headers }),
      app.request('/api/catalog', { headers }),
    ]);

    const status = (await statusRes.json()) as StatusReport;
    const catalog = (await catalogRes.json()) as Catalog;

    expect(status.applications.map((a) => a.id)).toEqual(catalog.applications.map((a) => a.id));
    expect(status.applications.map((a) => a.id)).toEqual(['media', 'docs']);
    expect(status.applications[0]?.services.map((s) => s.id)).toEqual([
      'jellyfin',
      'db',
      'docs-link',
    ]);
    expect(status.applications[0]?.status).toBe('down');
    expect(status.applications[1]?.services.map((s) => s.id)).toEqual(['wiki']);
  });

  it('collects once inside a five second window and again after expiry', async () => {
    const { baseUrl, listCalls } = await startProxy(healthyItems);
    let clock = 1_000_000;
    const app = createApp({
      config,
      env: envWith(baseUrl),
      logger: createLogger('error'),
      status: { now: () => clock },
    });
    const headers = remoteHeaders({ 'Remote-Groups': 'media-users' });

    const firstBatch = await Promise.all(
      Array.from({ length: 10 }, () => app.request('/api/status', { headers })),
    );
    expect(firstBatch.every((r) => r.status === 200)).toBe(true);
    expect(listCalls()).toBe(1);

    const firstBodies = await Promise.all(firstBatch.map((r) => r.json() as Promise<StatusReport>));
    const collectedAt = firstBodies[0]?.collectedAt;
    expect(collectedAt).toBeTruthy();
    expect(firstBodies.every((b) => b.collectedAt === collectedAt)).toBe(true);

    clock += STATUS_CACHE_TTL_MS - 1;
    const stillCached = await app.request('/api/status', { headers });
    expect(stillCached.status).toBe(200);
    expect(((await stillCached.json()) as StatusReport).collectedAt).toBe(collectedAt);
    expect(listCalls()).toBe(1);

    clock += 1;
    const refreshed = await app.request('/api/status', { headers });
    expect(refreshed.status).toBe(200);
    expect(listCalls()).toBe(2);
  });

  it('answers 200 with unknown statuses when the socket proxy is unreachable', async () => {
    const app = createApp({
      config,
      env: envWith('http://127.0.0.1:1'),
      logger: createLogger('error'),
    });

    const res = await app.request('/api/status', {
      headers: remoteHeaders({ 'Remote-Groups': 'system-admins' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as StatusReport;
    expect(body.applications.length).toBeGreaterThan(0);

    for (const appStatus of body.applications) {
      for (const service of appStatus.services) {
        if (service.status !== null) {
          expect(service.status).toBe('unknown');
          expect(service.since).toBeNull();
        }
      }
      if (appStatus.status !== null) {
        expect(appStatus.status).toBe('unknown');
        expect(appStatus.since).toBeNull();
      }
    }
  });

  it('answers 200 with unknown when DOCKER_PROXY_URL is unset', async () => {
    const app = createApp({
      config,
      env: envWith(undefined),
      logger: createLogger('error'),
    });

    const res = await app.request('/api/status', {
      headers: remoteHeaders({ 'Remote-Groups': 'media-users' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as StatusReport;
    const jellyfin = body.applications[0]?.services.find((s) => s.id === 'jellyfin');
    expect(jellyfin?.status).toBe('unknown');
  });
});
