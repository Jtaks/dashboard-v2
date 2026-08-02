import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import { TEST_VAPID_PUBLIC_KEY } from './test-helpers/constants.js';
import { initConfig, resetConfigForTesting } from './config/get-config.js';

const VALID_CONFIG = `
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

const CATALOG_CONFIG = `
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
    services: []
`;

const ALLOWED_ORIGIN = 'https://dashboard.example.com';
const LOGOUT_URL = 'https://auth.example.com/logout';
const DOCKER_PROXY_URL = 'http://docker-proxy.example.com';

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

describe('API integration', () => {
  it('rejects unauthenticated requests before handlers run', async () => {
    resetConfigForTesting();
    const configPath = await writeTempConfig(VALID_CONFIG);
    initConfig(configPath);

    const app = createApp({
      allowedOrigin: ALLOWED_ORIGIN,
      autheliaLogoutUrl: LOGOUT_URL,
      dockerProxyUrl: DOCKER_PROXY_URL,
      vapidPublicKey: TEST_VAPID_PUBLIC_KEY,
    });

    const response = await app.request('/api/session', {
      headers: headersForUser(null),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: 'unauthorized' });
  });

  it('returns session details for authenticated users', async () => {
    resetConfigForTesting();
    const configPath = await writeTempConfig(VALID_CONFIG);
    initConfig(configPath);

    const app = createApp({
      allowedOrigin: ALLOWED_ORIGIN,
      autheliaLogoutUrl: LOGOUT_URL,
      dockerProxyUrl: DOCKER_PROXY_URL,
      vapidPublicKey: TEST_VAPID_PUBLIC_KEY,
    });

    const response = await app.request('/api/session', {
      headers: headersForUser(regularUser),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      name: 'Alice',
      email: 'alice@example.com',
      admin: false,
      logoutUrl: LOGOUT_URL,
    });
  });

  it('marks admins based on configured adminGroup', async () => {
    resetConfigForTesting();
    const configPath = await writeTempConfig(VALID_CONFIG);
    initConfig(configPath);

    const app = createApp({
      allowedOrigin: ALLOWED_ORIGIN,
      autheliaLogoutUrl: LOGOUT_URL,
      dockerProxyUrl: DOCKER_PROXY_URL,
      vapidPublicKey: TEST_VAPID_PUBLIC_KEY,
    });

    const response = await app.request('/api/session', {
      headers: headersForUser(adminUser),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ admin: true });
  });

  it('refuses state-changing requests with a foreign or absent Origin', async () => {
    resetConfigForTesting();
    const configPath = await writeTempConfig(VALID_CONFIG);
    initConfig(configPath);

    const app = createApp({
      allowedOrigin: ALLOWED_ORIGIN,
      autheliaLogoutUrl: LOGOUT_URL,
      dockerProxyUrl: DOCKER_PROXY_URL,
      vapidPublicKey: TEST_VAPID_PUBLIC_KEY,
    });

    const absentOrigin = await app.request('/api/admin/topics', {
      method: 'POST',
      headers: headersForUser(adminUser),
    });
    expect(absentOrigin.status).toBe(403);
    expect(await absentOrigin.json()).toEqual({ code: 'origin_mismatch' });

    const foreignOrigin = await app.request('/api/admin/topics', {
      method: 'POST',
      headers: {
        ...headersForUser(adminUser),
        Origin: 'https://evil.example.com',
      },
    });
    expect(foreignOrigin.status).toBe(403);
    expect(await foreignOrigin.json()).toEqual({ code: 'origin_mismatch' });
  });

  it('allows state-changing requests from the configured origin', async () => {
    resetConfigForTesting();
    const configPath = await writeTempConfig(VALID_CONFIG);
    initConfig(configPath);

    const app = createApp({
      allowedOrigin: ALLOWED_ORIGIN,
      autheliaLogoutUrl: LOGOUT_URL,
      dockerProxyUrl: DOCKER_PROXY_URL,
      vapidPublicKey: TEST_VAPID_PUBLIC_KEY,
    });

    const response = await app.request('/api/admin/topics', {
      method: 'POST',
      headers: {
        ...headersForUser(adminUser),
        Origin: ALLOWED_ORIGIN,
      },
    });

    expect(response.status).not.toBe(403);
  });

  it('returns 403 for authenticated non-admin admin routes', async () => {
    resetConfigForTesting();
    const configPath = await writeTempConfig(VALID_CONFIG);
    initConfig(configPath);

    const app = createApp({
      allowedOrigin: ALLOWED_ORIGIN,
      autheliaLogoutUrl: LOGOUT_URL,
      dockerProxyUrl: DOCKER_PROXY_URL,
      vapidPublicKey: TEST_VAPID_PUBLIC_KEY,
    });

    const response = await app.request('/api/admin/topics', {
      headers: headersForUser(regularUser),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: 'forbidden' });
  });

  it('returns admin topics from config plus wildcard', async () => {
    resetConfigForTesting();
    const configPath = await writeTempConfig(VALID_CONFIG);
    initConfig(configPath);

    const app = createApp({
      allowedOrigin: ALLOWED_ORIGIN,
      autheliaLogoutUrl: LOGOUT_URL,
      dockerProxyUrl: DOCKER_PROXY_URL,
      vapidPublicKey: TEST_VAPID_PUBLIC_KEY,
    });

    const response = await app.request('/api/admin/topics', {
      headers: headersForUser(adminUser),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      topics: ['media-users', 'media-admins', '*'],
    });
  });

  it('returns JSON error shape for unknown API paths', async () => {
    resetConfigForTesting();
    const configPath = await writeTempConfig(VALID_CONFIG);
    initConfig(configPath);

    const app = createApp({
      allowedOrigin: ALLOWED_ORIGIN,
      autheliaLogoutUrl: LOGOUT_URL,
      dockerProxyUrl: DOCKER_PROXY_URL,
      vapidPublicKey: TEST_VAPID_PUBLIC_KEY,
    });

    const response = await app.request('/api/unknown', {
      headers: headersForUser(regularUser),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: 'not_found' });
  });

  it('rejects unauthenticated catalog requests before handlers run', async () => {
    resetConfigForTesting();
    const configPath = await writeTempConfig(CATALOG_CONFIG);
    initConfig(configPath);

    const app = createApp({
      allowedOrigin: ALLOWED_ORIGIN,
      autheliaLogoutUrl: LOGOUT_URL,
      dockerProxyUrl: DOCKER_PROXY_URL,
      vapidPublicKey: TEST_VAPID_PUBLIC_KEY,
    });

    const response = await app.request('/api/catalog', {
      headers: headersForUser(null),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: 'unauthorized' });
  });

  it('returns the entitled catalog for authenticated users', async () => {
    resetConfigForTesting();
    const configPath = await writeTempConfig(CATALOG_CONFIG);
    initConfig(configPath);

    const app = createApp({
      allowedOrigin: ALLOWED_ORIGIN,
      autheliaLogoutUrl: LOGOUT_URL,
      dockerProxyUrl: DOCKER_PROXY_URL,
      vapidPublicKey: TEST_VAPID_PUBLIC_KEY,
    });

    const response = await app.request('/api/catalog', {
      headers: headersForUser(regularUser),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      applications: [
        {
          id: 'media',
          name: 'Media',
          description: 'Films and series.',
          url: 'https://media.example.com',
          icon: 'media.svg',
          requestable: true,
          services: [
            { id: 'jellyfin', name: 'Jellyfin', hasContainers: true },
            { id: 'link-only', name: 'Link Only', hasContainers: false },
          ],
        },
      ],
    });
  });

  it('returns the full catalog for admin users', async () => {
    resetConfigForTesting();
    const configPath = await writeTempConfig(CATALOG_CONFIG);
    initConfig(configPath);

    const app = createApp({
      allowedOrigin: ALLOWED_ORIGIN,
      autheliaLogoutUrl: LOGOUT_URL,
      dockerProxyUrl: DOCKER_PROXY_URL,
      vapidPublicKey: TEST_VAPID_PUBLIC_KEY,
    });

    const response = await app.request('/api/catalog', {
      headers: headersForUser(adminUser),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      applications: [
        {
          id: 'media',
          name: 'Media',
          description: 'Films and series.',
          url: 'https://media.example.com',
          icon: 'media.svg',
          requestable: true,
          services: [
            { id: 'jellyfin', name: 'Jellyfin', hasContainers: true },
            { id: 'db', name: 'Database', hasContainers: true },
            { id: 'link-only', name: 'Link Only', hasContainers: false },
          ],
        },
        {
          id: 'other',
          name: 'Other',
          description: 'Other app.',
          url: 'https://other.example.com',
          icon: 'other.svg',
          requestable: false,
          services: [],
        },
      ],
    });
  });
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
