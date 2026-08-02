import type { StatusReport } from '@dashboard/shared';

/** Default TTL in front of daemon collection (TDD Health collection). */
export const STATUS_CACHE_TTL_MS = 5_000;

export type StatusCacheOptions = {
  /** Performs one unfiltered collection. */
  collect: () => Promise<StatusReport>;
  /** Clock for TTL checks (tests). Default Date.now. */
  now?: () => number;
  /** Cache window in ms. Default {@link STATUS_CACHE_TTL_MS}. */
  ttlMs?: number;
};

export type StatusCache = {
  /** Return the cached unfiltered report, collecting when the window has elapsed. */
  get: () => Promise<StatusReport>;
};

/**
 * Shared in-process cache for the unfiltered status collection.
 * Filtering stays per-request so entitlements never leak across users.
 * Concurrent callers while a collection is in flight share one promise.
 */
export function createStatusCache(options: StatusCacheOptions): StatusCache {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? STATUS_CACHE_TTL_MS;

  let cached: { report: StatusReport; expiresAt: number } | null = null;
  let inflight: Promise<StatusReport> | null = null;

  return {
    async get() {
      const t = now();
      if (cached !== null && t < cached.expiresAt) {
        return cached.report;
      }

      if (inflight !== null) {
        return inflight;
      }

      inflight = options
        .collect()
        .then((report) => {
          cached = { report, expiresAt: now() + ttlMs };
          return report;
        })
        .finally(() => {
          inflight = null;
        });

      return inflight;
    },
  };
}
