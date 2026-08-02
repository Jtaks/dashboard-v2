import type { Application } from '@dashboard/shared';

export function applicationMatchesSearch(application: Application, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') {
    return true;
  }

  return (
    application.name.toLowerCase().includes(normalized) ||
    application.description.toLowerCase().includes(normalized)
  );
}

export function filterApplications(applications: Application[], query: string): Application[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') {
    return applications;
  }

  return applications.filter((application) => applicationMatchesSearch(application, query));
}
