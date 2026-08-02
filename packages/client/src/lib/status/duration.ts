import * as m from '$lib/paraglide/messages';

export type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export type DerivedDuration = {
  unit: DurationUnit;
  count: number;
};

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

export function deriveDuration(since: string | null, now: Date): DerivedDuration | null {
  if (since === null) {
    return null;
  }

  const sinceMs = Date.parse(since);
  if (Number.isNaN(sinceMs)) {
    return null;
  }

  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - sinceMs) / 1000));
  if (elapsedSeconds === 0) {
    return null;
  }

  if (elapsedSeconds < SECONDS_PER_MINUTE) {
    return { unit: 'seconds', count: elapsedSeconds };
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / SECONDS_PER_MINUTE);
  if (elapsedMinutes < SECONDS_PER_MINUTE) {
    return { unit: 'minutes', count: elapsedMinutes };
  }

  const elapsedHours = Math.floor(elapsedSeconds / SECONDS_PER_HOUR);
  if (elapsedHours < 24) {
    return { unit: 'hours', count: elapsedHours };
  }

  return { unit: 'days', count: Math.floor(elapsedSeconds / SECONDS_PER_DAY) };
}

export function formatDuration(since: string | null, now: Date): string | null {
  const derived = deriveDuration(since, now);
  if (!derived) {
    return null;
  }

  switch (derived.unit) {
    case 'seconds':
      return m.duration_seconds({ count: derived.count });
    case 'minutes':
      return m.duration_minutes({ count: derived.count });
    case 'hours':
      return m.duration_hours({ count: derived.count });
    case 'days':
      return m.duration_days({ count: derived.count });
  }
}

export function formatUptime(since: string | null, now: Date): string | null {
  const duration = formatDuration(since, now);
  if (!duration) {
    return null;
  }

  return m.app_detail_uptime({ duration });
}
