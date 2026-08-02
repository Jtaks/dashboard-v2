import type { Status } from '@dashboard/shared';

import type { ContainerReading, DockerContainer } from './types.js';

export type ContainerStateInput = Pick<DockerContainer, 'state' | 'healthStatus' | 'startedAt'>;

function sinceForStatus(startedAt: string | undefined, status: Status): string | null {
  if (status === 'unknown' || !startedAt) {
    return null;
  }

  return startedAt;
}

function mapRunningHealth(healthStatus: string | undefined): Status {
  switch (healthStatus) {
    case 'starting':
      return 'starting';
    case 'unhealthy':
      return 'degraded';
    case 'healthy':
    case 'none':
    default:
      return 'up';
  }
}

export function mapContainerState(container: ContainerStateInput): ContainerReading {
  const { state, healthStatus, startedAt } = container;

  switch (state) {
    case 'running': {
      const status = mapRunningHealth(healthStatus);
      return { status, since: sinceForStatus(startedAt, status) };
    }
    case 'created': {
      const status: Status = 'starting';
      return { status, since: sinceForStatus(startedAt, status) };
    }
    case 'restarting': {
      const status: Status = 'degraded';
      return { status, since: sinceForStatus(startedAt, status) };
    }
    case 'exited':
    case 'dead':
    case 'removing':
    case 'paused': {
      const status: Status = 'down';
      return { status, since: sinceForStatus(startedAt, status) };
    }
    default: {
      const status: Status = 'down';
      return { status, since: sinceForStatus(startedAt, status) };
    }
  }
}

export function mapAbsentContainer(): ContainerReading {
  return { status: 'down', since: null };
}

export function mapUnreachableContainer(): ContainerReading {
  return { status: 'unknown', since: null };
}
