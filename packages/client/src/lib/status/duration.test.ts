import { describe, expect, it } from 'vitest';

import { deriveDuration, formatDuration } from './duration.js';

const now = new Date('2026-01-04T12:00:00.000Z');

function sinceSecondsAgo(seconds: number): string {
  return new Date(now.getTime() - seconds * 1000).toISOString();
}

function sinceDaysAgo(days: number): string {
  return sinceSecondsAgo(days * 24 * 60 * 60);
}

describe('deriveDuration', () => {
  it('returns null for a null since', () => {
    expect(deriveDuration(null, now)).toBeNull();
  });

  it('returns null for a since in the future', () => {
    expect(deriveDuration('2026-01-05T12:00:00.000Z', now)).toBeNull();
  });

  it('derives seconds below one minute', () => {
    expect(deriveDuration(sinceSecondsAgo(1), now)).toEqual({ unit: 'seconds', count: 1 });
    expect(deriveDuration(sinceSecondsAgo(2), now)).toEqual({ unit: 'seconds', count: 2 });
    expect(deriveDuration(sinceSecondsAgo(59), now)).toEqual({ unit: 'seconds', count: 59 });
  });

  it('derives minutes from sixty seconds up to under one hour', () => {
    expect(deriveDuration(sinceSecondsAgo(60), now)).toEqual({ unit: 'minutes', count: 1 });
    expect(deriveDuration(sinceSecondsAgo(90), now)).toEqual({ unit: 'minutes', count: 1 });
    expect(deriveDuration(sinceSecondsAgo(120), now)).toEqual({ unit: 'minutes', count: 2 });
    expect(deriveDuration(sinceSecondsAgo(59 * 60), now)).toEqual({ unit: 'minutes', count: 59 });
  });

  it('derives hours from sixty minutes up to under one day', () => {
    expect(deriveDuration(sinceSecondsAgo(60 * 60), now)).toEqual({ unit: 'hours', count: 1 });
    expect(deriveDuration(sinceSecondsAgo(2 * 60 * 60), now)).toEqual({ unit: 'hours', count: 2 });
    expect(deriveDuration(sinceSecondsAgo(23 * 60 * 60), now)).toEqual({ unit: 'hours', count: 23 });
  });

  it('derives days from twenty-four hours upward', () => {
    expect(deriveDuration(sinceDaysAgo(1), now)).toEqual({ unit: 'days', count: 1 });
    expect(deriveDuration(sinceDaysAgo(2), now)).toEqual({ unit: 'days', count: 2 });
    expect(deriveDuration(sinceDaysAgo(3), now)).toEqual({ unit: 'days', count: 3 });
  });
});

describe('formatDuration', () => {
  it('returns null for a null since', () => {
    expect(formatDuration(null, now)).toBeNull();
  });

  it('returns null for a since in the future', () => {
    expect(formatDuration('2026-01-05T12:00:00.000Z', now)).toBeNull();
  });

  it('formats second plural boundaries', () => {
    expect(formatDuration(sinceSecondsAgo(1), now)).toBe('1 second');
    expect(formatDuration(sinceSecondsAgo(2), now)).toBe('2 seconds');
  });

  it('formats minute plural boundaries', () => {
    expect(formatDuration(sinceSecondsAgo(60), now)).toBe('1 minute');
    expect(formatDuration(sinceSecondsAgo(90), now)).toBe('1 minute');
    expect(formatDuration(sinceSecondsAgo(120), now)).toBe('2 minutes');
  });

  it('formats hour plural boundaries', () => {
    expect(formatDuration(sinceSecondsAgo(60 * 60), now)).toBe('1 hour');
    expect(formatDuration(sinceSecondsAgo(2 * 60 * 60), now)).toBe('2 hours');
  });

  it('formats day plural boundaries', () => {
    expect(formatDuration(sinceDaysAgo(1), now)).toBe('1 day');
    expect(formatDuration(sinceDaysAgo(3), now)).toBe('3 days');
  });
});
