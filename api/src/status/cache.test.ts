import type { StatusReport } from '@dashboard/shared';
import { describe, expect, it, vi } from 'vitest';

import { createStatusCache, STATUS_CACHE_TTL_MS } from './cache.js';

function report(collectedAt: string): StatusReport {
  return { collectedAt, applications: [] };
}

describe('createStatusCache', () => {
  it('collects once inside the TTL window and again after expiry', async () => {
    let clock = 1_000_000;
    const collect = vi
      .fn<() => Promise<StatusReport>>()
      .mockResolvedValueOnce(report('t1'))
      .mockResolvedValueOnce(report('t2'));

    const cache = createStatusCache({
      collect,
      now: () => clock,
      ttlMs: STATUS_CACHE_TTL_MS,
    });

    const first = await Promise.all(Array.from({ length: 10 }, () => cache.get()));
    expect(collect).toHaveBeenCalledTimes(1);
    expect(new Set(first.map((r) => r.collectedAt))).toEqual(new Set(['t1']));

    clock += STATUS_CACHE_TTL_MS - 1;
    expect((await cache.get()).collectedAt).toBe('t1');
    expect(collect).toHaveBeenCalledTimes(1);

    clock += 1;
    expect((await cache.get()).collectedAt).toBe('t2');
    expect(collect).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent callers into one collection', async () => {
    let resolveCollect!: (value: StatusReport) => void;
    const collect = vi.fn(
      () =>
        new Promise<StatusReport>((resolve) => {
          resolveCollect = resolve;
        }),
    );

    const cache = createStatusCache({ collect, now: () => 0 });

    const pending = Promise.all([cache.get(), cache.get(), cache.get()]);
    expect(collect).toHaveBeenCalledTimes(1);

    resolveCollect(report('shared'));
    const results = await pending;
    expect(results.every((r) => r.collectedAt === 'shared')).toBe(true);
    expect(collect).toHaveBeenCalledTimes(1);
  });
});
