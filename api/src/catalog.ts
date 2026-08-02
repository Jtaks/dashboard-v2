import type { Application, Catalog, Service } from '@dashboard/shared';

import type { ResolvedConfig, ResolvedServiceConfig } from './config.js';
import { isAdmin } from './identity.js';

/** True when any configured group appears in the user's Remote-Groups (OR). */
export function groupsOverlap(required: readonly string[], userGroups: readonly string[]): boolean {
  return required.some((group) => userGroups.includes(group));
}

function toService(service: ResolvedServiceConfig): Service {
  return {
    id: service.id,
    name: service.name,
    hasContainers: service.containers.length > 0,
  };
}

/**
 * Project the loaded config into the Catalog response for a user's groups.
 * Pure: no I/O. Admins see every application and service; otherwise OR-match
 * application groups, then narrow services the same way (omitting mismatches).
 */
export function filterCatalog(config: ResolvedConfig, groups: readonly string[]): Catalog {
  if (isAdmin(groups, config.adminGroup)) {
    return {
      applications: config.applications.map((app): Application => ({
        id: app.id,
        name: app.name,
        description: app.description,
        url: app.url,
        icon: app.icon,
        requestable: app.requestable,
        services: app.services.map(toService),
      })),
    };
  }

  const applications: Application[] = [];

  for (const app of config.applications) {
    if (!groupsOverlap(app.groups, groups)) {
      continue;
    }

    applications.push({
      id: app.id,
      name: app.name,
      description: app.description,
      url: app.url,
      icon: app.icon,
      requestable: app.requestable,
      services: app.services.filter((svc) => groupsOverlap(svc.groups, groups)).map(toService),
    });
  }

  return { applications };
}
