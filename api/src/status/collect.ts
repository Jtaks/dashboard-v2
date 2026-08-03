import {
  aggregateStatuses,
  type ApplicationStatus,
  type ServiceStatus,
  type Status,
  type StatusReport,
} from '@dashboard/shared';

import type { ResolvedConfig, ResolvedServiceConfig } from '../config.js';
import { createDockerClient, type DockerClient } from '../docker/client.js';
import { mapContainerStatus, normalizeStartedAt } from '../docker/map-status.js';
import type { ContainerSnapshot } from '../docker/types.js';

export type StatusCollectorLogger = {
  warn: (fields: { msg: string; service?: string; container?: string }) => void;
};

export type CollectStatusOptions = {
  /** Socket proxy base URL. Required unless `docker` is injected. */
  dockerProxyUrl?: string | undefined;
  /** Injected client for tests. */
  docker?: DockerClient | undefined;
  logger?: StatusCollectorLogger | undefined;
  /** Fixed clock for collectedAt in tests. */
  now?: (() => Date) | undefined;
};

type Reading = {
  status: Status;
  since: string | null;
};

const silentLogger: StatusCollectorLogger = {
  warn: () => {},
};

/**
 * Among readings that share `target` status, pick the earliest since.
 * Null when status is null/unknown or no contributor has a since.
 */
export function sinceForAggregate(
  readings: readonly { status: Status | null; since: string | null }[],
  target: Status | null,
): string | null {
  if (target === null || target === 'unknown') {
    return null;
  }
  let earliest: string | null = null;
  for (const reading of readings) {
    if (reading.status !== target || reading.since === null) {
      continue;
    }
    if (earliest === null || reading.since < earliest) {
      earliest = reading.since;
    }
  }
  return earliest;
}

function readingFromSnapshot(snapshot: ContainerSnapshot | null): Reading {
  const status = mapContainerStatus(snapshot);
  // mapContainerStatus never returns unknown; keep the guard for Status exhaustiveness.
  if (status === 'unknown') {
    return { status, since: null };
  }
  const since = snapshot ? normalizeStartedAt(snapshot.startedAt) : null;
  return { status, since };
}

function aggregateReadings(readings: readonly Reading[]): {
  status: Status | null;
  since: string | null;
} {
  const status = aggregateStatuses(readings.map((r) => r.status));
  return { status, since: sinceForAggregate(readings, status) };
}

function collectUniqueContainerNames(config: ResolvedConfig): string[] {
  const names = new Set<string>();
  for (const app of config.applications) {
    for (const service of app.services) {
      for (const name of service.containers) {
        names.add(name);
      }
    }
  }
  return [...names];
}

function resolveService(
  service: ResolvedServiceConfig,
  snapshots: Map<string, ContainerSnapshot> | null,
  unreachable: boolean,
  logger: StatusCollectorLogger,
  warnedAbsent: Set<string>,
): ServiceStatus {
  if (service.containers.length === 0) {
    return { id: service.id, status: null, since: null };
  }

  if (unreachable || snapshots === null) {
    return { id: service.id, status: 'unknown', since: null };
  }

  const readings: Reading[] = [];
  for (const containerName of service.containers) {
    const snapshot = snapshots.get(containerName) ?? null;
    if (snapshot === null) {
      const warnKey = `${service.id}\0${containerName}`;
      if (!warnedAbsent.has(warnKey)) {
        warnedAbsent.add(warnKey);
        logger.warn({
          msg: `container "${containerName}" named by service "${service.id}" was not found on the daemon`,
          service: service.id,
          container: containerName,
        });
      }
      readings.push({ status: 'down', since: null });
      continue;
    }
    readings.push(readingFromSnapshot(snapshot));
  }

  const { status, since } = aggregateReadings(readings);
  return { id: service.id, status, since };
}

/**
 * Collect container state from the Engine API through the socket proxy and
 * produce a full {@link StatusReport}. Never throws on proxy failure — an
 * unreachable proxy yields `unknown` throughout.
 *
 * One call performs a single list pass over the daemon; container names shared
 * by multiple services are resolved from that same snapshot map.
 */
export async function collectStatus(
  config: ResolvedConfig,
  options: CollectStatusOptions = {},
): Promise<StatusReport> {
  const logger = options.logger ?? silentLogger;
  const now = options.now ?? (() => new Date());
  const collectedAt = now().toISOString();

  let snapshots: Map<string, ContainerSnapshot> | null = null;
  let unreachable = false;

  const client =
    options.docker ??
    (options.dockerProxyUrl ? createDockerClient({ baseUrl: options.dockerProxyUrl }) : null);

  if (client === null) {
    unreachable = true;
  } else {
    try {
      snapshots = await client.listSnapshots();
      const needed = collectUniqueContainerNames(config);
      await client.enrichStartedAt(snapshots, needed);
    } catch {
      // Proxy refuse, bad payload, or inspect connectivity failure → unknown throughout.
      unreachable = true;
      snapshots = null;
    }
  }

  const warnedAbsent = new Set<string>();
  const applications: ApplicationStatus[] = config.applications.map((app) => {
    const services = app.services.map((service) =>
      resolveService(service, snapshots, unreachable, logger, warnedAbsent),
    );

    const serviceReadings = services.map((s) => ({ status: s.status, since: s.since }));
    // aggregateStatuses already skips nulls; all-null → null application status.
    const status = aggregateStatuses(services.map((s) => s.status));
    // When several services tie for worst, take the earliest since among them.
    // Prefer the since of the determining service(s) via sinceForAggregate.
    let since = sinceForAggregate(serviceReadings, status);

    if (status === 'unknown' || status === null) {
      since = null;
    }

    return { id: app.id, status, since, services };
  });

  return { collectedAt, applications };
}
