import type { Application } from '@dashboard/shared';

/**
 * Case-insensitive substring match on application name or description.
 * An empty (or whitespace-only) query matches every application.
 */
export function applicationMatchesQuery(application: Application, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return (
    application.name.toLowerCase().includes(needle) ||
    application.description.toLowerCase().includes(needle)
  );
}

/**
 * Filter a catalog list by search query. Empty query returns the same array
 * reference unchanged so list and grid share one filtered result without churn.
 */
export function filterApplicationsByQuery(
  applications: Application[],
  query: string,
): Application[] {
  if (!query.trim()) {
    return applications;
  }
  return applications.filter((application) => applicationMatchesQuery(application, query));
}
