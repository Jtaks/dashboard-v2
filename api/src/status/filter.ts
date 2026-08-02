import {
  aggregateStatuses,
  type StatusReport,
} from '@dashboard/shared';

import { filterCatalog } from '../catalog.js';
import type { ResolvedConfig } from '../config.js';
import { sinceForAggregate } from './collect.js';

/**
 * Project a full (unfiltered) status report to the applications and services
 * the user is entitled to see, using the same entitlement rules as the catalog.
 *
 * Application aggregate status and since are recomputed from visible services
 * only — an invisible degraded service must not darken an entitled app.
 */
export function filterStatusReport(
  report: StatusReport,
  config: ResolvedConfig,
  groups: readonly string[],
): StatusReport {
  const catalog = filterCatalog(config, groups);
  const entitled = new Map(
    catalog.applications.map((app) => [
      app.id,
      new Set(app.services.map((service) => service.id)),
    ]),
  );

  const applications = report.applications
    .filter((app) => entitled.has(app.id))
    .map((app) => {
      const allowed = entitled.get(app.id)!;
      const services = app.services.filter((service) => allowed.has(service.id));
      const status = aggregateStatuses(services.map((s) => s.status));
      const since =
        status === null || status === 'unknown'
          ? null
          : sinceForAggregate(
              services.map((s) => ({ status: s.status, since: s.since })),
              status,
            );

      return { id: app.id, status, since, services };
    });

  return { collectedAt: report.collectedAt, applications };
}
