import type { StatusReport } from '@dashboard/shared';
import {
  QueryClient,
  QueryObserver,
  environmentManager,
  focusManager,
  notifyManager,
} from '@tanstack/svelte-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, UnauthorizedError } from '$lib/api/client.js';
import {
  STATUS_REFETCH_INTERVAL_MS,
  readStatusQueryState,
  statusQueryKey,
  statusQueryOptions,
} from './query.js';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const reportA: StatusReport = {
  collectedAt: '2026-01-01T12:00:00.000Z',
  applications: [
    {
      id: 'media',
      status: 'up',
      since: '2026-01-01T00:00:00.000Z',
      services: [{ id: 'jellyfin', status: 'up', since: '2026-01-01T00:00:00.000Z' }],
    },
  ],
};

const reportB: StatusReport = {
  collectedAt: '2026-01-01T12:00:07.000Z',
  applications: [
    {
      id: 'media',
      status: 'degraded',
      since: '2026-01-01T12:00:01.000Z',
      services: [{ id: 'jellyfin', status: 'degraded', since: '2026-01-01T12:00:01.000Z' }],
    },
  ],
};

async function flush() {
  await vi.advanceTimersByTimeAsync(0);
  await Promise.resolve();
  await Promise.resolve();
}

describe('statusQueryOptions', () => {
  let client: QueryClient;
  let fetchMock: ReturnType<typeof vi.fn>;
  const unsubscribers: Array<() => void> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    // Vitest runs in Node; Query skips refetchInterval while isServer is true.
    environmentManager.setIsServer(() => false);
    notifyManager.setScheduler((cb) => cb());
    focusManager.setFocused(true);

    fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, reportA));
    vi.stubGlobal('fetch', fetchMock);

    client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });
    client.mount();
  });

  afterEach(() => {
    while (unsubscribers.length) {
      unsubscribers.pop()?.();
    }
    client.clear();
    client.unmount();
    focusManager.setFocused(true);
    environmentManager.setIsServer(() => typeof window === 'undefined');
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function subscribe(observer: QueryObserver<StatusReport, Error>) {
    unsubscribers.push(observer.subscribe(() => {}));
  }

  it('uses a single query key and seven-second interval', () => {
    const options = statusQueryOptions();
    expect(options.queryKey).toEqual(statusQueryKey);
    expect(STATUS_REFETCH_INTERVAL_MS).toBe(7_000);
    expect(options.staleTime).toBe(STATUS_REFETCH_INTERVAL_MS);
    expect(options.refetchIntervalInBackground).toBe(false);
    expect(options.retry).toBe(false);
  });

  it('deduplicates fetches across several subscribers', async () => {
    const observerA = new QueryObserver(client, statusQueryOptions());
    const observerB = new QueryObserver(client, statusQueryOptions());
    const observerC = new QueryObserver(client, statusQueryOptions());
    subscribe(observerA);
    subscribe(observerB);
    subscribe(observerC);

    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/status');
    expect(observerA.getCurrentResult().data).toEqual(reportA);
    expect(observerB.getCurrentResult().data).toEqual(reportA);
    expect(observerC.getCurrentResult().data).toEqual(reportA);
  });

  it('refetches on the seven-second interval', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, reportA))
      .mockResolvedValueOnce(jsonResponse(200, reportB));

    const observer = new QueryObserver(client, statusQueryOptions());
    subscribe(observer);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().data).toEqual(reportA);

    await vi.advanceTimersByTimeAsync(STATUS_REFETCH_INTERVAL_MS - 1);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().data).toEqual(reportB);
  });

  it('pauses interval fetches while hidden and refetches immediately on resume', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, reportA))
      .mockResolvedValueOnce(jsonResponse(200, reportB));

    const observer = new QueryObserver(client, statusQueryOptions());
    subscribe(observer);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    focusManager.setFocused(false);

    await vi.advanceTimersByTimeAsync(STATUS_REFETCH_INTERVAL_MS * 3);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    focusManager.setFocused(true);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().data).toEqual(reportB);

    fetchMock.mockResolvedValueOnce(jsonResponse(200, reportA));
    await vi.advanceTimersByTimeAsync(STATUS_REFETCH_INTERVAL_MS);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('keeps the last successful report when a poll fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, reportA))
      .mockResolvedValueOnce(jsonResponse(500, { code: 'upstream_error' }));

    const observer = new QueryObserver(client, statusQueryOptions());
    subscribe(observer);
    await flush();
    expect(observer.getCurrentResult().data).toEqual(reportA);

    await vi.advanceTimersByTimeAsync(STATUS_REFETCH_INTERVAL_MS);
    await flush();

    const result = observer.getCurrentResult();
    expect(result.data).toEqual(reportA);
    expect(result.error).toBeInstanceOf(ApiRequestError);
    expect(result.isError).toBe(true);

    const snapshot = readStatusQueryState(result);
    expect(snapshot.report).toEqual(reportA);
    expect(snapshot.isLoading).toBe(false);
    expect(snapshot.error).toBeInstanceOf(ApiRequestError);
  });

  it('stops polling after a 401 and surfaces UnauthorizedError', async () => {
    const location = 'https://auth.example/login';
    fetchMock.mockResolvedValueOnce(jsonResponse(200, reportA)).mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'unauthorized' }), {
        status: 401,
        headers: { Location: location, 'Content-Type': 'application/json' },
      }),
    );

    const observer = new QueryObserver(client, statusQueryOptions());
    subscribe(observer);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(STATUS_REFETCH_INTERVAL_MS);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().error).toBeInstanceOf(UnauthorizedError);

    await vi.advanceTimersByTimeAsync(STATUS_REFETCH_INTERVAL_MS * 2);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('readStatusQueryState', () => {
  it('exposes loading, error, and last-successful separately', () => {
    expect(
      readStatusQueryState({
        data: undefined,
        error: null,
        isPending: true,
      }),
    ).toEqual({ report: null, isLoading: true, error: null });

    expect(
      readStatusQueryState({
        data: reportA,
        error: null,
        isPending: false,
      }),
    ).toEqual({ report: reportA, isLoading: false, error: null });

    const err = new ApiRequestError(500, 'upstream_error');
    expect(
      readStatusQueryState({
        data: reportA,
        error: err,
        isPending: false,
      }),
    ).toEqual({ report: reportA, isLoading: false, error: err });
  });
});
