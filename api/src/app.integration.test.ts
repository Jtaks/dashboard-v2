import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Session } from '@dashboard/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';
import { loadConfig, resetConfigForTests, type ResolvedConfig } from './config.js';
import { ErrorCodes } from './errors.js';
import type { RuntimeEnv } from './env.js';
import { identityFromHeaders } from './identity.js';
import { createLogger } from './logging.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const testEnv: RuntimeEnv = {
  port: 3000,
  logLevel: 'error',
  allowedOrigin: 'https://dashboard.example.com',
  autheliaLogoutUrl: 'https://auth.example.com/logout',
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

describe('API identity pipeline', () => {
  let config: ResolvedConfig;

  beforeEach(() => {
    resetConfigForTests();
    config = loadConfig(join(fixturesDir, 'valid.yaml'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    resetConfigForTests();
    vi.restoreAllMocks();
  });

  function app(registerApi?: Parameters<typeof createApp>[0]['registerApi']) {
    return createApp({
      config,
      env: testEnv,
      logger: createLogger('error'),
      registerApi,
    });
  }

  describe('GET /api/session', () => {
    it('answers 401 with the JSON error shape when Remote-User is absent', async () => {
      const headers = remoteHeaders();
      delete headers['Remote-User'];

      const res = await app().request('/api/session', { headers });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ code: ErrorCodes.unauthorized });
    });

    it('answers 401 when all Remote-* headers are missing', async () => {
      const res = await app().request('/api/session');

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ code: ErrorCodes.unauthorized });
    });

    it('returns name, email, admin false, and logoutUrl for a non-admin user', async () => {
      const res = await app().request('/api/session', {
        headers: remoteHeaders({ 'Remote-Groups': 'media-users' }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as Session;
      expect(body).toEqual({
        name: 'Alice Example',
        email: 'alice@example.com',
        admin: false,
        logoutUrl: testEnv.autheliaLogoutUrl,
      });
    });

    it('sets admin true only when groups contain adminGroup', async () => {
      const res = await app().request('/api/session', {
        headers: remoteHeaders({
          'Remote-Groups': 'media-users,system-admins',
          'Remote-Name': 'Admin Alice',
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as Session;
      expect(body.admin).toBe(true);
      expect(body.name).toBe('Admin Alice');
    });
  });

  describe('GET /api/admin/topics', () => {
    it('answers 403 with the shared error shape for an authenticated non-admin', async () => {
      const res = await app().request('/api/admin/topics', {
        headers: remoteHeaders({ 'Remote-Groups': 'media-users' }),
      });

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ code: ErrorCodes.forbidden });
    });

    it('returns configured groups plus * for an admin', async () => {
      const res = await app().request('/api/admin/topics', {
        headers: remoteHeaders({ 'Remote-Groups': 'system-admins' }),
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(['media-users', 'media-admins', '*']);
    });

    it('answers 401 before the admin guard when identity is missing', async () => {
      const res = await app().request('/api/admin/topics');

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ code: ErrorCodes.unauthorized });
    });
  });

  describe('origin check on state-changing methods', () => {
    function appWithProbe() {
      return app((api) => {
        // Probe for CSRF tests; later epics mount real POST/PATCH/DELETE handlers.
        api.post('/probe', (c) => c.json({ ok: true }));
      });
    }

    it('refuses a foreign Origin', async () => {
      const res = await appWithProbe().request('/api/probe', {
        method: 'POST',
        headers: {
          ...remoteHeaders(),
          Origin: 'https://evil.example.com',
        },
      });

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ code: ErrorCodes.invalidOrigin });
    });

    it('refuses an absent Origin', async () => {
      const res = await appWithProbe().request('/api/probe', {
        method: 'POST',
        headers: remoteHeaders(),
      });

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ code: ErrorCodes.invalidOrigin });
    });

    it('proceeds when Origin matches ALLOWED_ORIGIN', async () => {
      const res = await appWithProbe().request('/api/probe', {
        method: 'POST',
        headers: {
          ...remoteHeaders(),
          Origin: testEnv.allowedOrigin,
        },
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });
  });

  describe('unknown paths', () => {
    it('answers with the JSON error shape rather than HTML', async () => {
      const res = await app().request('/api/does-not-exist', {
        headers: remoteHeaders(),
      });

      expect(res.status).toBe(404);
      expect(res.headers.get('content-type')).toMatch(/application\/json/);
      const body = await res.json();
      expect(body).toEqual({ code: ErrorCodes.notFound });
      expect(JSON.stringify(body)).not.toMatch(/<html/i);
    });
  });
});

describe('identityFromHeaders fail-closed', () => {
  it('rejects empty Remote-Groups', () => {
    expect(
      identityFromHeaders({
        user: 'alice',
        groups: '',
        email: 'a@b.c',
        name: 'Alice',
      }),
    ).toBeNull();
    expect(
      identityFromHeaders({
        user: 'alice',
        groups: ' , ',
        email: 'a@b.c',
        name: 'Alice',
      }),
    ).toBeNull();
  });
});
