import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ResolvedConfig } from '../config.js';
import { createDockerClient } from '../docker/client.js';
import { collectStatus } from './collect.js';

type ListItem = {
  Id: string;
  Names: string[];
  State: string;
  Status: string;
  Health?: { Status: string };
  StartedAt?: string;
};

function configWith(services: ResolvedConfig['applications'][0]['services']): ResolvedConfig {
  return {
    adminGroup: 'system-admins',
    groups: ['media-users'],
    applications: [
      {
        id: 'media',
        name: 'Media',
        description: 'Films',
        url: 'https://media.example.com',
        icon: 'media.svg',
        requestable: false,
        groups: ['media-users'],
        services,
      },
    ],
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

describe('collectStatus integration', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
          }),
      ),
    );
    vi.restoreAllMocks();
  });

  it('reports up when every container is running with no healthcheck, degraded with one unhealthy', async () => {
    const items: ListItem[] = [
      {
        Id: '1',
        Names: ['/jellyfin'],
        State: 'running',
        Status: 'Up 2 hours',
        StartedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        Id: '2',
        Names: ['/jellyfin-db'],
        State: 'running',
        Status: 'Up 2 hours',
        StartedAt: '2024-01-01T01:00:00.000Z',
      },
    ];
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

    const config = configWith([
      { id: 'jellyfin', name: 'Jellyfin', containers: ['jellyfin'], groups: ['media-users'] },
      { id: 'db', name: 'Database', containers: ['jellyfin-db'], groups: ['media-users'] },
    ]);

    const healthy = await collectStatus(config, { dockerProxyUrl: baseUrl });
    expect(listCalls).toBe(1);
    expect(healthy.applications[0]?.status).toBe('up');
    expect(healthy.applications[0]?.services.map((s) => s.status)).toEqual(['up', 'up']);

    items[1] = {
      Id: '2',
      Names: ['/jellyfin-db'],
      State: 'running',
      Status: 'Up 2 hours (unhealthy)',
      Health: { Status: 'unhealthy' },
      StartedAt: '2024-01-01T01:00:00.000Z',
    };

    const degraded = await collectStatus(config, { dockerProxyUrl: baseUrl });
    expect(listCalls).toBe(2);
    expect(degraded.applications[0]?.status).toBe('degraded');
    expect(degraded.applications[0]?.services.find((s) => s.id === 'db')?.status).toBe('degraded');
  });

  it('reports down and emits exactly one warning for a missing container name', async () => {
    const warnings: Array<{ msg: string; service?: string; container?: string }> = [];
    const { server, baseUrl } = await listen((req, res) => {
      if (req.method === 'GET' && req.url?.startsWith('/containers/json')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    servers.push(server);

    const config = configWith([
      {
        id: 'jellyfin',
        name: 'Jellyfin',
        containers: ['missing-box'],
        groups: ['media-users'],
      },
    ]);

    const report = await collectStatus(config, {
      dockerProxyUrl: baseUrl,
      logger: { warn: (fields) => warnings.push(fields) },
    });

    expect(report.applications[0]?.services[0]?.status).toBe('down');
    expect(report.applications[0]?.status).toBe('down');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.service).toBe('jellyfin');
    expect(warnings[0]?.container).toBe('missing-box');
    expect(warnings[0]?.msg).toContain('missing-box');
    expect(warnings[0]?.msg).toContain('jellyfin');
  });

  it('yields unknown throughout when the proxy refuses connections, never down', async () => {
    const { server, baseUrl } = await listen((_req, res) => {
      res.socket?.destroy();
    });
    servers.push(server);
    // Close immediately so subsequent fetches get ECONNREFUSED.
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    servers.pop();

    const config = configWith([
      { id: 'jellyfin', name: 'Jellyfin', containers: ['jellyfin'], groups: ['media-users'] },
      { id: 'link', name: 'Docs', containers: [], groups: ['media-users'] },
    ]);

    const report = await collectStatus(config, { dockerProxyUrl: baseUrl });

    expect(report.applications[0]?.services[0]?.status).toBe('unknown');
    expect(report.applications[0]?.services[1]?.status).toBeNull();
    expect(report.applications[0]?.status).toBe('unknown');
    const statuses = report.applications.flatMap((a) => [
      a.status,
      ...a.services.map((s) => s.status),
    ]);
    expect(statuses.every((s) => s === 'unknown' || s === null)).toBe(true);
    expect(statuses).not.toContain('down');
  });

  it('excludes null services from app aggregate; all-null services yield app null', async () => {
    const { server, baseUrl } = await listen((req, res) => {
      if (req.method === 'GET' && req.url?.startsWith('/containers/json')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    servers.push(server);

    const config = configWith([
      { id: 'docs', name: 'Docs', containers: [], groups: ['media-users'] },
      { id: 'wiki', name: 'Wiki', containers: [], groups: ['media-users'] },
    ]);

    const report = await collectStatus(config, { dockerProxyUrl: baseUrl });
    expect(report.applications[0]?.services.every((s) => s.status === null)).toBe(true);
    expect(report.applications[0]?.status).toBeNull();
    expect(report.applications[0]?.since).toBeNull();
  });

  it('makes a single list pass when multiple services share a container name', async () => {
    let listCalls = 0;
    const { server, baseUrl } = await listen((req, res) => {
      if (req.method === 'GET' && req.url?.startsWith('/containers/json')) {
        listCalls += 1;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify([
            {
              Id: '1',
              Names: ['/shared'],
              State: 'running',
              Status: 'Up 1 hour',
              StartedAt: '2024-03-01T00:00:00.000Z',
            },
          ]),
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });
    servers.push(server);

    const config = configWith([
      { id: 'a', name: 'A', containers: ['shared'], groups: ['media-users'] },
      { id: 'b', name: 'B', containers: ['shared'], groups: ['media-users'] },
    ]);

    const docker = createDockerClient({ baseUrl });
    const listSpy = vi.spyOn(docker, 'listSnapshots');

    const report = await collectStatus(config, { docker });
    expect(listCalls).toBe(1);
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(report.applications[0]?.services.map((s) => s.status)).toEqual(['up', 'up']);
  });
});
