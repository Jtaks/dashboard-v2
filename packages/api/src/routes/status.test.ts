import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import { TEST_VAPID_PUBLIC_KEY } from '../test-helpers/constants.js';
import { initConfig, resetConfigForTesting } from '../config/get-config.js';
import * as collectStatusModule from '../status/collect-status.js';

const STATUS_CONFIG = `
adminGroup: system-admins
groups:
  - media-users
  - media-admins
  - other-users
applications:
  - id: media
    name: Media
    description: Films and series.
    url: https://media.example.com
    icon: media.svg
    groups: [media-users]
    requestable: true
    services:
      - id: jellyfin
        name: Jellyfin
        containers: [jellyfin-container]
      - id: db
        name: Database
        containers: [jellyfin-db-container]
        groups: [media-admins]
      - id: link-only
        name: Link Only
        containers: []
  - id: other
    name: Other
    description: Other app.
    url: https://other.example.com
    icon: other.svg
    groups: [other-users]
    services:
      - id: svc
        name: Service
        containers: [other-container]
`;

const ALLOWED_ORIGIN = 'https://dashboard.example.com';
const LOGOUT_URL = 'https://auth.example.com/logout';

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

function containerFixture(
  name: string,
  state: string,
  healthStatus?: string,
  startedAt?: string,
) {
  return {
    Id: `id-${name}`,
    Names: [`/${name}`],
    State: state,
    ...(healthStatus ? { Health: { Status: healthStatus } } : {}),
    ...(startedAt ? { StartedAt: startedAt } : {}),
  };
}

describe('GET /api/status', () => {
  let server: Server | null = null;
  let proxyUrl = '';
  let collectStatusSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    collectStatusSpy = vi.spyOn(collectStatusModule, 'collectStatus');
  });

  afterEach(async () => {
    collectStatusSpy.mockRestore();
    resetConfigForTesting();

    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => (error ? reject(error) : resolve()));
      });
      server = null;
    }
  });

  async function writeTempConfig(contents: string): Promise<string> {
    const { mkdtemp, writeFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    const directory = await mkdtemp(join(tmpdir(), 'dashboard-config-'));
    const configPath = join(directory, 'dashboard.yaml');
    await writeFile(configPath, contents, 'utf8');
    return configPath;
  }

  async function startProxy(
    handler: (url: string) => { statusCode: number; body?: string } | 'hang',
  ) {
    server = createServer((request, response) => {
      const result = handler(request.url ?? '');

      if (result === 'hang') {
        return;
      }

      response.statusCode = result.statusCode;
      if (result.body !== undefined) {
        response.setHeader('content-type', 'application/json');
        response.end(result.body);
        return;
      }

      response.end();
    });

    await new Promise<void>((resolve) => {
      server!.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address() as AddressInfo;
    proxyUrl = `http://127.0.0.1:${address.port}`;
  }

  async function createTestApp() {
    resetConfigForTesting();
    const configPath = await writeTempConfig(STATUS_CONFIG);
    initConfig(configPath);

    return createApp({
      allowedOrigin: ALLOWED_ORIGIN,
      autheliaLogoutUrl: LOGOUT_URL,
      dockerProxyUrl: proxyUrl,
      logLevel: 'error',
      vapidPublicKey: TEST_VAPID_PUBLIC_KEY,
    });
  }

  async function startHealthyProxy() {
    await startProxy((url) => {
      if (url === '/containers/json?all=true') {
        return {
          statusCode: 200,
          body: JSON.stringify([
            containerFixture(
              'jellyfin-container',
              'running',
              'healthy',
              '2026-08-01T08:00:00.000000000Z',
            ),
            containerFixture(
              'jellyfin-db-container',
              'running',
              'unhealthy',
              '2026-08-01T07:00:00.000000000Z',
            ),
            containerFixture(
              'other-container',
              'running',
              'healthy',
              '2026-08-01T09:00:00.000000000Z',
            ),
          ]),
        };
      }

      return { statusCode: 404 };
    });
  }

  it('rejects unauthenticated requests before collection runs', async () => {
    await startHealthyProxy();
    const app = await createTestApp();

    const response = await app.request('/api/status', {
      headers: headersForUser(null),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: 'unauthorized' });
    expect(collectStatusSpy).not.toHaveBeenCalled();
  });

  it('returns the entitled status report for non-admin users', async () => {
    await startHealthyProxy();
    const app = await createTestApp();

    const response = await app.request('/api/status', {
      headers: headersForUser(regularUser),
    });

    expect(response.status).toBe(200);
    const report = await response.json();

    expect(report.applications).toHaveLength(1);
    expect(report.applications[0]?.id).toBe('media');
    expect(report.applications[0]?.services.map((service: { id: string }) => service.id)).toEqual([
      'jellyfin',
      'link-only',
    ]);
    expect(report.applications[0]?.services).not.toContainEqual(
      expect.objectContaining({ id: 'db' }),
    );
    expect(report.applications[0]?.status).toBe('up');
    expect(report.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns the full status report for admin users', async () => {
    await startHealthyProxy();
    const app = await createTestApp();

    const response = await app.request('/api/status', {
      headers: headersForUser(adminUser),
    });

    expect(response.status).toBe(200);
    const report = await response.json();

    expect(report.applications.map((application: { id: string }) => application.id)).toEqual([
      'media',
      'other',
    ]);

    const media = report.applications.find((application: { id: string }) => application.id === 'media');
    expect(media?.services.map((service: { id: string }) => service.id)).toEqual([
      'jellyfin',
      'db',
      'link-only',
    ]);
    expect(media?.status).toBe('degraded');
  });

  it('excludes hidden services from application aggregation', async () => {
    await startHealthyProxy();
    const app = await createTestApp();

    const [regularResponse, adminResponse] = await Promise.all([
      app.request('/api/status', { headers: headersForUser(regularUser) }),
      app.request('/api/status', { headers: headersForUser(adminUser) }),
    ]);

    const regularReport = await regularResponse.json();
    const adminReport = await adminResponse.json();

    const regularMedia = regularReport.applications.find(
      (application: { id: string }) => application.id === 'media',
    );
    const adminMedia = adminReport.applications.find(
      (application: { id: string }) => application.id === 'media',
    );

    expect(regularMedia?.status).toBe('up');
    expect(adminMedia?.status).toBe('degraded');
  });

  it('collects once per five second cache window across repeated requests', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T12:00:00.000Z'));

    try {
      await startHealthyProxy();
      const app = await createTestApp();

      const requests = Array.from({ length: 10 }, () =>
        app.request('/api/status', { headers: headersForUser(regularUser) }),
      );
      const responses = await Promise.all(requests);

      for (const response of responses) {
        expect(response.status).toBe(200);
      }

      expect(collectStatusSpy).toHaveBeenCalledTimes(1);

      const firstCollectedAt = (await responses[0]!.json()).collectedAt;

      vi.advanceTimersByTime(5001);

      const afterWindow = await app.request('/api/status', {
        headers: headersForUser(regularUser),
      });

      expect(afterWindow.status).toBe(200);
      expect(collectStatusSpy).toHaveBeenCalledTimes(2);

      const secondCollectedAt = (await afterWindow.json()).collectedAt;
      expect(secondCollectedAt).not.toBe(firstCollectedAt);
    } finally {
      vi.useRealTimers();
    }
  });

  it('answers 200 with unknown statuses when the socket proxy is unreachable', async () => {
    await startProxy(() => 'hang');
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => (error ? reject(error) : resolve()));
    });
    server = null;

    const app = await createTestApp();

    const response = await app.request('/api/status', {
      headers: headersForUser(adminUser),
    });

    expect(response.status).toBe(200);
    const report = await response.json();

    for (const application of report.applications) {
      for (const service of application.services) {
        if (service.status === null) {
          continue;
        }

        expect(service.status).toBe('unknown');
        expect(service.since).toBeNull();
      }

      if (application.status !== null) {
        expect(application.status).toBe('unknown');
        expect(application.since).toBeNull();
      }
    }
  });
});
