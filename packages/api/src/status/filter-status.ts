import type { ApplicationStatus, StatusReport } from '@dashboard/shared';

import { buildCatalog } from '../catalog/build-catalog.js';
import type { ResolvedDashboardConfig } from '../config/load-config.js';
import { aggregateReadings } from './aggregate-readings.js';

function reaggregateApplication(application: ApplicationStatus): ApplicationStatus {
  const aggregated = aggregateReadings(
    application.services.flatMap((service) =>
      service.status === null ? [] : [{ status: service.status, since: service.since }],
    ),
  );

  return {
    id: application.id,
    status: aggregated.status,
    since: aggregated.since,
    services: application.services,
  };
}

export function filterStatusReport(
  report: StatusReport,
  config: ResolvedDashboardConfig,
  groups: string[],
): StatusReport {
  const catalog = buildCatalog(config, groups);
  const visibleApplications = new Map(
    catalog.applications.map((application) => [
      application.id,
      new Set(application.services.map((service) => service.id)),
    ]),
  );

  const applications = report.applications
    .filter((application) => visibleApplications.has(application.id))
    .map((application) => {
      const visibleServiceIds = visibleApplications.get(application.id)!;
      const services = application.services.filter((service) => visibleServiceIds.has(service.id));
      return reaggregateApplication({ ...application, services });
    });

  return {
    collectedAt: report.collectedAt,
    applications,
  };
}
