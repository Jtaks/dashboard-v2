import { describe, expect, it } from 'vitest';
import { durationLabel, elapsedDuration, formatSinceDuration } from './duration.js';

const NOW = Date.parse('2026-01-10T12:00:00.000Z');

function sinceOffset(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

describe('elapsedDuration', () => {
  it('returns null for a null since', () => {
    expect(elapsedDuration(null, NOW)).toBeNull();
  });

  it('derives seconds below one minute', () => {
    expect(elapsedDuration(sinceOffset(0), NOW)).toEqual({ unit: 'seconds', count: 0 });
    expect(elapsedDuration(sinceOffset(1_000), NOW)).toEqual({ unit: 'seconds', count: 1 });
    expect(elapsedDuration(sinceOffset(59_000), NOW)).toEqual({ unit: 'seconds', count: 59 });
  });

  it('derives minutes from sixty seconds upward, including ninety seconds', () => {
    expect(elapsedDuration(sinceOffset(60_000), NOW)).toEqual({ unit: 'minutes', count: 1 });
    expect(elapsedDuration(sinceOffset(90_000), NOW)).toEqual({ unit: 'minutes', count: 1 });
    expect(elapsedDuration(sinceOffset(120_000), NOW)).toEqual({ unit: 'minutes', count: 2 });
    expect(elapsedDuration(sinceOffset(3_599_000), NOW)).toEqual({ unit: 'minutes', count: 59 });
  });

  it('derives hours below one day', () => {
    expect(elapsedDuration(sinceOffset(3_600_000), NOW)).toEqual({ unit: 'hours', count: 1 });
    expect(elapsedDuration(sinceOffset(7_200_000), NOW)).toEqual({ unit: 'hours', count: 2 });
    expect(elapsedDuration(sinceOffset(86_399_000), NOW)).toEqual({ unit: 'hours', count: 23 });
  });

  it('derives days from a three-day-old since', () => {
    expect(elapsedDuration(sinceOffset(86_400_000), NOW)).toEqual({ unit: 'days', count: 1 });
    expect(elapsedDuration(sinceOffset(3 * 86_400_000), NOW)).toEqual({ unit: 'days', count: 3 });
  });

  it('clamps a future since to zero seconds rather than a negative duration', () => {
    expect(elapsedDuration(new Date(NOW + 60_000).toISOString(), NOW)).toEqual({
      unit: 'seconds',
      count: 0,
    });
  });

  it('accepts Date and ISO string now values', () => {
    expect(elapsedDuration(sinceOffset(5_000), new Date(NOW))).toEqual({
      unit: 'seconds',
      count: 5,
    });
    expect(elapsedDuration(sinceOffset(5_000), new Date(NOW).toISOString())).toEqual({
      unit: 'seconds',
      count: 5,
    });
  });
});

describe('durationLabel plural boundaries', () => {
  it('uses English one/other forms for each unit', () => {
    expect(durationLabel({ unit: 'seconds', count: 1 })).toBe('for 1 second');
    expect(durationLabel({ unit: 'seconds', count: 2 })).toBe('for 2 seconds');
    expect(durationLabel({ unit: 'minutes', count: 1 })).toBe('for 1 minute');
    expect(durationLabel({ unit: 'minutes', count: 2 })).toBe('for 2 minutes');
    expect(durationLabel({ unit: 'hours', count: 1 })).toBe('for 1 hour');
    expect(durationLabel({ unit: 'hours', count: 2 })).toBe('for 2 hours');
    expect(durationLabel({ unit: 'days', count: 1 })).toBe('for 1 day');
    expect(durationLabel({ unit: 'days', count: 3 })).toBe('for 3 days');
  });
});

describe('formatSinceDuration', () => {
  it('returns null for a null since', () => {
    expect(formatSinceDuration(null, NOW)).toBeNull();
  });

  it('formats ninety seconds as minutes and three days as days', () => {
    expect(formatSinceDuration(sinceOffset(90_000), NOW)).toBe('for 1 minute');
    expect(formatSinceDuration(sinceOffset(3 * 86_400_000), NOW)).toBe('for 3 days');
  });

  it('formats a future since without a negative duration', () => {
    expect(formatSinceDuration(new Date(NOW + 5_000).toISOString(), NOW)).toBe('for 0 seconds');
  });
});
