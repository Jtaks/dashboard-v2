import { m } from '$lib/paraglide/messages.js';

export type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export type DurationParts = {
  unit: DurationUnit;
  count: number;
};

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function toEpochMs(value: number | string | Date): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Elapsed duration from `since` to `now`, floored to the largest unit below its threshold.
 * null `since` → null. A future `since` clamps to zero seconds (never negative).
 */
export function elapsedDuration(
  since: string | null,
  now: number | string | Date,
): DurationParts | null {
  if (since === null) {
    return null;
  }
  const sinceMs = toEpochMs(since);
  const nowMs = toEpochMs(now);
  if (sinceMs === null || nowMs === null) {
    return null;
  }

  const elapsed = Math.max(0, nowMs - sinceMs);

  if (elapsed < MINUTE_MS) {
    return { unit: 'seconds', count: Math.floor(elapsed / SECOND_MS) };
  }
  if (elapsed < HOUR_MS) {
    return { unit: 'minutes', count: Math.floor(elapsed / MINUTE_MS) };
  }
  if (elapsed < DAY_MS) {
    return { unit: 'hours', count: Math.floor(elapsed / HOUR_MS) };
  }
  return { unit: 'days', count: Math.floor(elapsed / DAY_MS) };
}

/** Resolve duration parts through the Paraglide catalog — never assemble units inline. */
export function durationLabel(parts: DurationParts): string {
  switch (parts.unit) {
    case 'seconds':
      return m.duration_seconds({ count: parts.count });
    case 'minutes':
      return m.duration_minutes({ count: parts.count });
    case 'hours':
      return m.duration_hours({ count: parts.count });
    case 'days':
      return m.duration_days({ count: parts.count });
  }
}

/**
 * Elapsed duration label from `since` to `now`, or null when there is nothing to show.
 */
export function formatSinceDuration(
  since: string | null,
  now: number | string | Date,
): string | null {
  const parts = elapsedDuration(since, now);
  return parts === null ? null : durationLabel(parts);
}
