import type { ApplicationStatus, ServiceStatus, StatusReport } from '@dashboard/shared';

import type { ResolvedDashboardConfig } from '../config/load-config.js';
import type { createLogger } from '../lib/logger.js';
import { aggregateReadings } from './aggregate-readings.js';
import { indexContainersByName, listContainers } from './docker-client.js';
import {
  mapAbsentContainer,
  mapContainerState,
  mapUnreachableContainer,
} from './map-container-state.js';
import type { ContainerReading, DockerContainer } from './types.js';

export type StatusLogger = ReturnType<typeof createLogger>;

function collectServiceStatus(
  serviceId: string,
  containerNames: string[],
  containersByName: Map<string, DockerContainer> | null,
  proxyReachable: boolean,
  logger: StatusLogger,
  serviceName: string,
): ServiceStatus {
  if (containerNames.length === 0) {
    return { id: serviceId, status: null, since: null };
  }

  const readings: ContainerReading[] = containerNames.map((containerName) => {
    if (!proxyReachable) {
      return mapUnreachableContainer();
    }

    const container = containersByName?.get(containerName);

    if (!container) {
      logger.warn('Container not found in daemon', { service: serviceName, container: containerName });
      return mapAbsentContainer();
    }

    return mapContainerState(container);
  });

  const aggregated = aggregateReadings(readings);
  return { id: serviceId, status: aggregated.status, since: aggregated.since };
}

export async function collectStatus(
  config: ResolvedDashboardConfig,
  dockerProxyUrl: string,
  logger: StatusLogger,
): Promise<StatusReport> {
  const containers = await listContainers(dockerProxyUrl);
  const proxyReachable = containers !== null;
  const containersByName = proxyReachable ? indexContainersByName(containers) : null;

  const applications: ApplicationStatus[] = config.applications.map((application) => {
    const services: ServiceStatus[] = application.services.map((service) =>
      collectServiceStatus(
        service.id,
        service.containers,
        containersByName,
        proxyReachable,
        logger,
        service.name,
      ),
    );

    const aggregated = aggregateReadings(
      services.flatMap((service) =>
        service.status === null
          ? []
          : [{ status: service.status, since: service.since }],
      ),
    );

    return {
      id: application.id,
      status: aggregated.status,
      since: aggregated.since,
      services,
    };
  });

  return {
    collectedAt: new Date().toISOString(),
    applications,
  };
}
