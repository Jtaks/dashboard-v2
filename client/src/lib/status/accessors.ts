import type { ApplicationStatus, ServiceStatus, StatusReport } from '@dashboard/shared';

/**
 * Application status for an id. Absent id → null (not an error).
 * Present entry with `status: null` (no badgeable reading) is returned as-is.
 */
export function getApplicationStatus(
  report: StatusReport | null | undefined,
  applicationId: string,
): ApplicationStatus | null {
  if (!report) {
    return null;
  }
  return report.applications.find((application) => application.id === applicationId) ?? null;
}

/**
 * Service status for an application/service id pair. Absent id → null (not an error).
 */
export function getServiceStatus(
  report: StatusReport | null | undefined,
  applicationId: string,
  serviceId: string,
): ServiceStatus | null {
  const application = getApplicationStatus(report, applicationId);
  if (!application) {
    return null;
  }
  return application.services.find((service) => service.id === serviceId) ?? null;
}
