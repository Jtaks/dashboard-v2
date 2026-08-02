import { describe, expect, it } from 'vitest';

import { mapContainerStatus, normalizeStartedAt } from '../docker/map-status.js';
import type { ContainerSnapshot } from '../docker/types.js';

function snap(
  partial: Partial<ContainerSnapshot> & Pick<ContainerSnapshot, 'state'>,
): ContainerSnapshot {
  return {
    name: partial.name ?? 'ctr',
    state: partial.state,
    health: partial.health ?? null,
    startedAt: partial.startedAt ?? null,
  };
}

describe('mapContainerStatus', () => {
  it('maps running with no healthcheck to up', () => {
    expect(mapContainerStatus(snap({ state: 'running', health: null }))).toBe('up');
  });

  it('maps running with health healthy to up', () => {
    expect(mapContainerStatus(snap({ state: 'running', health: 'healthy' }))).toBe('up');
  });

  it('maps running with health starting to starting', () => {
    expect(mapContainerStatus(snap({ state: 'running', health: 'starting' }))).toBe('starting');
  });

  it('maps running with health unhealthy to degraded', () => {
    expect(mapContainerStatus(snap({ state: 'running', health: 'unhealthy' }))).toBe('degraded');
  });

  it('maps restarting to degraded', () => {
    expect(mapContainerStatus(snap({ state: 'restarting' }))).toBe('degraded');
  });

  it('maps exited to down', () => {
    expect(mapContainerStatus(snap({ state: 'exited' }))).toBe('down');
  });

  it('maps paused to down', () => {
    expect(mapContainerStatus(snap({ state: 'paused' }))).toBe('down');
  });

  it('maps dead and removing to down', () => {
    expect(mapContainerStatus(snap({ state: 'dead' }))).toBe('down');
    expect(mapContainerStatus(snap({ state: 'removing' }))).toBe('down');
  });

  it('maps created to starting', () => {
    expect(mapContainerStatus(snap({ state: 'created' }))).toBe('starting');
  });

  it('maps a name absent from the listing (null snapshot) to down', () => {
    expect(mapContainerStatus(null)).toBe('down');
  });
});

describe('normalizeStartedAt', () => {
  it('returns ISO for a daemon timestamp', () => {
    expect(normalizeStartedAt('2024-06-01T12:00:00.123456789Z')).toBe('2024-06-01T12:00:00.123Z');
  });

  it('returns null for zero-value and empty timestamps', () => {
    expect(normalizeStartedAt('0001-01-01T00:00:00Z')).toBeNull();
    expect(normalizeStartedAt('')).toBeNull();
    expect(normalizeStartedAt(null)).toBeNull();
  });
});
