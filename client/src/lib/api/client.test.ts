import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiRequestError, ForbiddenError, UnauthorizedError } from './client.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('apiFetch', () => {
  it('sends Accept: application/json on every request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/session');

    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('Accept')).toBe('application/json');
  });

  it('throws UnauthorizedError with Location on 401', async () => {
    const location = 'https://auth.example/login?rd=%2Fsettings';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'unauthorized' }), {
          status: 401,
          headers: { Location: location, 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(apiFetch('/api/session')).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error).toMatchObject({ status: 401, location });
      return true;
    });
  });

  it('throws ForbiddenError distinct from unauthorized on 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, { code: 'forbidden' })));

    await expect(apiFetch('/api/admin/topics')).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error).not.toBeInstanceOf(UnauthorizedError);
      expect(error).toMatchObject({ status: 403, code: 'forbidden' });
      return true;
    });
  });

  it('surfaces non-JSON error bodies as handled ApiRequestError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>gateway error</html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );

    await expect(apiFetch('/api/catalog')).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ApiRequestError);
      expect(error).toMatchObject({ status: 502, code: null });
      return true;
    });
  });
});
