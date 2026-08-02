import type { StatusReport } from '@dashboard/shared';
import { QueryObserver, environmentManager, focusManager } from '@tanstack/query-core';
import { QueryClient, keepPreviousData } from '@tanstack/svelte-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client.js';
import {
  STATUS_REFETCH_INTERVAL_MS,
  isDocumentVisible,
  resolveStatusRefetchInterval,
  statusQueryKey,
  statusQueryOptions,
} from './query.js';

const successReport: StatusReport = {
  collectedAt: '2026-01-01T12:00:00.000Z',
  applications: [
    {
      id: 'media',
      status: 'up',
      since: '2026-01-01T10:00:00.000Z',
      services: [],
    },
  ],
};

const updatedReport: StatusReport = {
  collectedAt: '2026-01-01T12:07:00.000Z',
  applications: [
    {
      id: 'media',
      status: 'degraded',
      since: '2026-01-01T12:05:00.000Z',
      services: [],
    },
  ],
};

function createTestQueryClient() {
  environmentManager.setIsServer(() => false);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  queryClient.mount();

  return queryClient;
}

function destroyTestQueryClient(queryClient: QueryClient) {
  queryClient.unmount();
  environmentManager.setIsServer(() => typeof window === 'undefined');
}

let visibilityState: DocumentVisibilityState = 'visible';
const visibilityListeners = new Set<EventListener>();

function installDocumentMock() {
  visibilityState = 'visible';
  visibilityListeners.clear();

  vi.stubGlobal('document', {
    get visibilityState() {
      return visibilityState;
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn((event: Event) => {
      if (event.type === 'visibilitychange') {
        for (const listener of visibilityListeners) {
          listener(event);
        }
      }

      return true;
    }),
  });

  vi.stubGlobal('window', {
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      if (type === 'visibilitychange') {
        visibilityListeners.add(listener);
      }
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      if (type === 'visibilitychange') {
        visibilityListeners.delete(listener);
      }
    }),
  });
}

function mockVisibilityState(state: DocumentVisibilityState) {
  visibilityState = state;
  for (const listener of visibilityListeners) {
    listener(new Event('visibilitychange'));
  }
}

function subscribeToStatusQuery(
  queryClient: QueryClient,
  options: ReturnType<typeof statusQueryOptions> & { queryFn: () => Promise<StatusReport> },
) {
  const observer = new QueryObserver(queryClient, options);
  return observer.subscribe(() => {});
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('status query configuration', () => {
  it('uses a single status query key and seven second interval', () => {
    expect(statusQueryKey).toEqual(['status']);

    const options = statusQueryOptions();
    expect(options.queryKey).toEqual(['status']);
    expect(options.refetchIntervalInBackground).toBe(false);
    expect(options.refetchOnWindowFocus).toBe('always');
    expect(options.placeholderData).toBe(keepPreviousData);
    expect(resolveStatusRefetchInterval()).toBe(STATUS_REFETCH_INTERVAL_MS);
    expect(STATUS_REFETCH_INTERVAL_MS).toBe(7_000);
  });

  it('does not retry auth errors', () => {
    const options = statusQueryOptions();

    expect(options.retry(0, new ApiError(401, 'unauthorized', 'https://auth.example/login'))).toBe(
      false,
    );
    expect(options.retry(0, new ApiError(403, 'forbidden', null))).toBe(false);
    expect(options.retry(0, new Error('network'))).toBe(true);
  });
});

describe('status query polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installDocumentMock();
  });

  it('deduplicates concurrent fetches for the same query key', async () => {
    const fetchStatus = vi.fn().mockResolvedValue(successReport);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(successReport), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    );

    const queryClient = createTestQueryClient();
    const options = { ...statusQueryOptions(), queryFn: fetchStatus };

    await Promise.all([
      queryClient.fetchQuery(options),
      queryClient.fetchQuery(options),
      queryClient.fetchQuery(options),
    ]);

    expect(fetchStatus).toHaveBeenCalledOnce();
    destroyTestQueryClient(queryClient);
  });

  it('refetches on the seven second interval while visible', async () => {
    vi.useRealTimers();

    let callCount = 0;
    const fetchStatus = vi.fn().mockImplementation(async () => {
      callCount += 1;
      return callCount === 1 ? successReport : updatedReport;
    });

    const queryClient = createTestQueryClient();
    const testIntervalMs = 50;
    const options = {
      ...statusQueryOptions(),
      queryFn: fetchStatus,
      refetchInterval: testIntervalMs,
    };
    const unsubscribe = subscribeToStatusQuery(queryClient, options);

    await vi.waitFor(() => {
      expect(fetchStatus).toHaveBeenCalledTimes(1);
    });

    await new Promise((resolve) => {
      setTimeout(resolve, testIntervalMs + 25);
    });

    await vi.waitFor(() => {
      expect(fetchStatus).toHaveBeenCalledTimes(2);
    });

    const cached = queryClient.getQueryData<StatusReport>(statusQueryKey);
    expect(cached?.collectedAt).toBe(updatedReport.collectedAt);

    unsubscribe();
    destroyTestQueryClient(queryClient);
  }, 10_000);

  it('pauses polling while hidden and refetches once when visible again', async () => {
    const fetchStatus = vi.fn().mockResolvedValue(successReport);
    const queryClient = createTestQueryClient();
    const options = { ...statusQueryOptions(), queryFn: fetchStatus };
    const unsubscribe = subscribeToStatusQuery(queryClient, options);

    await vi.waitFor(() => {
      expect(fetchStatus).toHaveBeenCalledTimes(1);
    });

    mockVisibilityState('hidden');
    expect(isDocumentVisible()).toBe(false);
    expect(resolveStatusRefetchInterval()).toBe(false);

    await vi.advanceTimersByTimeAsync(STATUS_REFETCH_INTERVAL_MS * 2);
    expect(fetchStatus).toHaveBeenCalledTimes(1);

    mockVisibilityState('visible');
    expect(isDocumentVisible()).toBe(true);
    focusManager.onFocus();

    await vi.waitFor(() => {
      expect(fetchStatus).toHaveBeenCalledTimes(2);
    });

    unsubscribe();
    destroyTestQueryClient(queryClient);
  });

  it('preserves the previous report when a poll fails', async () => {
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce(successReport)
      .mockRejectedValueOnce(new Error('poll failed'));

    const queryClient = createTestQueryClient();
    const options = {
      ...statusQueryOptions(),
      queryFn: fetchStatus,
      retry: false,
    };

    await queryClient.fetchQuery(options);
    expect(queryClient.getQueryData<StatusReport>(statusQueryKey)?.collectedAt).toBe(
      successReport.collectedAt,
    );

    await expect(queryClient.fetchQuery(options)).rejects.toThrow('poll failed');

    const cached = queryClient.getQueryData<StatusReport>(statusQueryKey);
    expect(cached?.collectedAt).toBe(successReport.collectedAt);

    const state = queryClient.getQueryState<StatusReport>(statusQueryKey);
    expect(state?.error).toBeInstanceOf(Error);
    expect(state?.data?.collectedAt).toBe(successReport.collectedAt);
    destroyTestQueryClient(queryClient);
  });
});
