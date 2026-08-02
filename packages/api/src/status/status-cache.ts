import type { StatusReport } from '@dashboard/shared';

export const STATUS_CACHE_TTL_MS = 5000;

export type StatusCacheDeps = {
  collect: () => Promise<StatusReport>;
  now?: () => number;
  ttlMs?: number;
};

export function createStatusCache(deps: StatusCacheDeps) {
  const now = deps.now ?? (() => Date.now());
  const ttlMs = deps.ttlMs ?? STATUS_CACHE_TTL_MS;

  let cached: StatusReport | null = null;
  let cachedAt = 0;
  let inFlight: Promise<StatusReport> | null = null;

  async function getUnfilteredReport(): Promise<StatusReport> {
    const current = now();

    if (cached !== null && current - cachedAt < ttlMs) {
      return cached;
    }

    if (!inFlight) {
      inFlight = deps.collect().then((report) => {
        cached = report;
        cachedAt = now();
        inFlight = null;
        return report;
      });
    }

    return inFlight;
  }

  function resetForTesting(): void {
    cached = null;
    cachedAt = 0;
    inFlight = null;
  }

  return { getUnfilteredReport, resetForTesting };
}
