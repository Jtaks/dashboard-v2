import { describe, expect, it } from 'vitest';

import {
  mapAbsentContainer,
  mapContainerState,
  mapUnreachableContainer,
} from './map-container-state.js';

describe('mapContainerState', () => {
  it('maps running with no healthcheck to up', () => {
    expect(mapContainerState({ state: 'running' })).toEqual({
      status: 'up',
      since: null,
    });
  });

  it('maps running with health healthy to up', () => {
    expect(
      mapContainerState({
        state: 'running',
        healthStatus: 'healthy',
        startedAt: '2026-08-01T10:00:00.000000000Z',
      }),
    ).toEqual({
      status: 'up',
      since: '2026-08-01T10:00:00.000000000Z',
    });
  });

  it('maps running with health none to up', () => {
    expect(mapContainerState({ state: 'running', healthStatus: 'none' })).toEqual({
      status: 'up',
      since: null,
    });
  });

  it('maps running with health starting to starting', () => {
    expect(
      mapContainerState({
        state: 'running',
        healthStatus: 'starting',
        startedAt: '2026-08-01T10:00:00.000000000Z',
      }),
    ).toEqual({
      status: 'starting',
      since: '2026-08-01T10:00:00.000000000Z',
    });
  });

  it('maps running with health unhealthy to degraded', () => {
    expect(
      mapContainerState({
        state: 'running',
        healthStatus: 'unhealthy',
        startedAt: '2026-08-01T10:00:00.000000000Z',
      }),
    ).toEqual({
      status: 'degraded',
      since: '2026-08-01T10:00:00.000000000Z',
    });
  });

  it('maps restarting to degraded', () => {
    expect(mapContainerState({ state: 'restarting' })).toEqual({
      status: 'degraded',
      since: null,
    });
  });

  it('maps created to starting', () => {
    expect(mapContainerState({ state: 'created' })).toEqual({
      status: 'starting',
      since: null,
    });
  });

  it('maps exited to down', () => {
    expect(mapContainerState({ state: 'exited' })).toEqual({
      status: 'down',
      since: null,
    });
  });

  it('maps paused to down', () => {
    expect(mapContainerState({ state: 'paused' })).toEqual({
      status: 'down',
      since: null,
    });
  });

  it('maps dead and removing to down', () => {
    expect(mapContainerState({ state: 'dead' })).toEqual({ status: 'down', since: null });
    expect(mapContainerState({ state: 'removing' })).toEqual({ status: 'down', since: null });
  });
});

describe('mapAbsentContainer', () => {
  it('maps a name absent from the listing to down', () => {
    expect(mapAbsentContainer()).toEqual({ status: 'down', since: null });
  });
});

describe('mapUnreachableContainer', () => {
  it('maps an unreachable proxy to unknown', () => {
    expect(mapUnreachableContainer()).toEqual({ status: 'unknown', since: null });
  });
});
