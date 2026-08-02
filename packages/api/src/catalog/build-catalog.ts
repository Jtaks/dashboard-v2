import type { Application, Catalog, Service } from '@dashboard/shared';

import type { ResolvedApplicationConfig, ResolvedDashboardConfig, ResolvedServiceConfig } from '../config/load-config.js';

function hasMatchingGroup(requiredGroups: string[], userGroups: string[]): boolean {
  return requiredGroups.some((group) => userGroups.includes(group));
}

function isAdmin(config: ResolvedDashboardConfig, groups: string[]): boolean {
  return groups.includes(config.adminGroup);
}

function projectService(service: ResolvedServiceConfig): Service {
  return {
    id: service.id,
    name: service.name,
    hasContainers: service.containers.length > 0,
  };
}

function projectApplication(
  application: ResolvedApplicationConfig,
  services: ResolvedServiceConfig[],
): Application {
  return {
    id: application.id,
    name: application.name,
    description: application.description,
    url: application.url,
    icon: application.icon,
    requestable: application.requestable,
    services: services.map(projectService),
  };
}

function visibleServices(
  application: ResolvedApplicationConfig,
  userGroups: string[],
): ResolvedServiceConfig[] {
  return application.services.filter((service) => hasMatchingGroup(service.groups, userGroups));
}

function visibleApplications(
  config: ResolvedDashboardConfig,
  userGroups: string[],
): ResolvedApplicationConfig[] {
  return config.applications.filter((application) => hasMatchingGroup(application.groups, userGroups));
}

export function buildCatalog(config: ResolvedDashboardConfig, groups: string[]): Catalog {
  if (isAdmin(config, groups)) {
    return {
      applications: config.applications.map((application) =>
        projectApplication(application, application.services),
      ),
    };
  }

  return {
    applications: visibleApplications(config, groups).map((application) =>
      projectApplication(application, visibleServices(application, groups)),
    ),
  };
}
