import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadConfigFromString } from '../config/load-config.js';
import { createLogger } from '../lib/logger.js';
import { collectStatus } from './collect-status.js';

const STATUS_CONFIG = `
groups:
  - media-users
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
      - id: db
        name: Database
        containers: [jellyfin-db-container]
      - id: link-only
        name: Link Only
        containers: []
  - id: other
    name: Other
    description: Other app.
    url: https://other.example.com
    icon: other.svg
    groups: [media-users]
    services:
      - id: svc
        name: Service
        containers: [other-container, missing-container]
`;

function loadStatusConfig() {
  return loadConfigFromString(STATUS_CONFIG);
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

describe('collectStatus', () => {
  let server: Server | null = null;
  let proxyUrl = '';
  let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(async () => {
    fetchSpy?.mockRestore();

    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => (error ? reject(error) : resolve()));
      });
      server = null;
    }
  });

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

  it('collects status from a faked socket proxy in a single daemon pass', async () => {
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
              undefined,
              '2026-08-01T09:00:00.000000000Z',
            ),
            containerFixture(
              'other-container',
              'running',
              'unhealthy',
              '2026-08-01T07:00:00.000000000Z',
            ),
          ]),
        };
      }

      return { statusCode: 404 };
    });

    const logger = createLogger('error');
    const report = await collectStatus(loadStatusConfig(), proxyUrl, logger);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(`${proxyUrl}/containers/json?all=true`, {
      method: 'GET',
    });

    const media = report.applications.find((application) => application.id === 'media');
    const other = report.applications.find((application) => application.id === 'other');

    expect(media?.services).toEqual([
      {
        id: 'jellyfin',
        status: 'up',
        since: '2026-08-01T08:00:00.000000000Z',
      },
      {
        id: 'db',
        status: 'up',
        since: '2026-08-01T09:00:00.000000000Z',
      },
      {
        id: 'link-only',
        status: null,
        since: null,
      },
    ]);
    expect(media?.status).toBe('up');

    expect(other?.services).toEqual([
      {
        id: 'svc',
        status: 'down',
        since: null,
      },
    ]);
    expect(other?.status).toBe('down');
    expect(report.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('logs one warning and reports down when a configured container name is missing', async () => {
    const missingNameConfig = loadConfigFromString(`
groups:
  - users
applications:
  - id: app
    name: App
    description: Test app.
    url: https://app.example.com
    icon: app.svg
    groups: [users]
    services:
      - id: svc
        name: Service
        containers: [present-container, missing-container]
`);

    await startProxy((url) => {
      if (url === '/containers/json?all=true') {
        return {
          statusCode: 200,
          body: JSON.stringify([
            containerFixture('present-container', 'running', 'healthy', '2026-08-01T08:00:00.000000000Z'),
          ]),
        };
      }

      return { statusCode: 404 };
    });

    const warn = vi.fn();
    const logger = { ...createLogger('error'), warn };
    const report = await collectStatus(missingNameConfig, proxyUrl, logger);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('Container not found in daemon', {
      service: 'Service',
      container: 'missing-container',
    });

    const app = report.applications.find((application) => application.id === 'app');
    expect(app?.services[0]?.status).toBe('down');
  });

  it('returns unknown for every container when the proxy refuses connections', async () => {
    await startProxy(() => 'hang');
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => (error ? reject(error) : resolve()));
    });
    server = null;

    const logger = createLogger('error');
    const report = await collectStatus(loadStatusConfig(), proxyUrl, logger);

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

    expect(report.applications).toHaveLength(2);
  });

  it('reuses one daemon listing when multiple services share a container name', async () => {
    const sharedConfig = loadConfigFromString(`
groups:
  - users
applications:
  - id: shared
    name: Shared
    description: Shared container.
    url: https://shared.example.com
    icon: shared.svg
    groups: [users]
    services:
      - id: a
        name: Service A
        containers: [shared-container]
      - id: b
        name: Service B
        containers: [shared-container]
`);

    await startProxy((url) => {
      if (url === '/containers/json?all=true') {
        return {
          statusCode: 200,
          body: JSON.stringify([
            containerFixture('shared-container', 'running', 'healthy', '2026-08-01T08:00:00.000000000Z'),
          ]),
        };
      }

      return { statusCode: 404 };
    });

    const logger = createLogger('error');
    await collectStatus(sharedConfig, proxyUrl, logger);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
