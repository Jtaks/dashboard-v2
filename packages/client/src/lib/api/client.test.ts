import { describe, expect, it, vi, afterEach } from 'vitest';

import { ApiError, ApiParseError, apiFetch, apiJson } from './client.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('sends Accept: application/json on every request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/session');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('Accept')).toBe('application/json');
  });

  it('throws ApiError with location on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'unauthorized' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            Location: 'https://auth.example/login?rd=https%3A%2F%2Fdashboard.example%2F',
          },
        }),
      ),
    );

    await expect(apiFetch('/api/session')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'unauthorized',
      location: 'https://auth.example/login?rd=https%3A%2F%2Fdashboard.example%2F',
      isUnauthorized: true,
      isForbidden: false,
    } satisfies Partial<ApiError>);
  });

  it('throws ApiError without location on 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(apiFetch('/api/session')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'forbidden',
      location: null,
      isUnauthorized: false,
      isForbidden: true,
    } satisfies Partial<ApiError>);
  });

  it('surfaces non-JSON error bodies without throwing a parse crash', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>gateway error</html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );

    await expect(apiFetch('/api/session')).rejects.toMatchObject({
      name: 'ApiError',
      status: 502,
      code: null,
    } satisfies Partial<ApiError>);
  });
});

describe('apiJson', () => {
  it('throws ApiParseError when success response is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('not json', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        }),
      ),
    );

    await expect(apiJson('/api/session')).rejects.toBeInstanceOf(ApiParseError);
  });
});
