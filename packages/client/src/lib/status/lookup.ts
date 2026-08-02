import type { ApplicationStatus, ServiceStatus, StatusReport } from '@dashboard/shared';

export function findApplicationStatus(
  report: StatusReport,
  applicationId: string,
): ApplicationStatus | null {
  return report.applications.find((application) => application.id === applicationId) ?? null;
}

export function findServiceStatus(
  report: StatusReport,
  applicationId: string,
  serviceId: string,
): ServiceStatus | null {
  const application = findApplicationStatus(report, applicationId);
  if (!application) {
    return null;
  }

  return application.services.find((service) => service.id === serviceId) ?? null;
}
