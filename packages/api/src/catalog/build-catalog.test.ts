import { describe, expect, it } from 'vitest';

import { buildCatalog } from './build-catalog.js';
import { loadConfigFromString } from '../config/load-config.js';

const CATALOG_CONFIG = `
adminGroup: system-admins
groups:
  - media-users
  - media-admins
  - other-users
applications:
  - id: media
    name: Media
    description: Films and series.
    url: https://media.example.com
    icon: media.svg
    groups: [media-users]
    requestable: true
    services:
      - id: jellyfin
        name: Jellyfin
        containers: [jellyfin-container]
      - id: db
        name: Database
        containers: [jellyfin-db-container]
        groups: [media-admins]
      - id: link-only
        name: Link Only
        containers: []
  - id: other
    name: Other
    description: Other app.
    url: https://other.example.com
    icon: other.svg
    groups: [other-users]
    services:
      - id: svc
        name: Service
        containers: [other-container]
`;

function loadCatalogConfig() {
  return loadConfigFromString(CATALOG_CONFIG);
}

describe('buildCatalog', () => {
  it('returns an application when the user matches one of its groups', () => {
    const catalog = buildCatalog(loadCatalogConfig(), ['media-users']);

    expect(catalog.applications).toHaveLength(1);
    expect(catalog.applications[0]?.id).toBe('media');
  });

  it('returns an empty applications array when no group matches', () => {
    const catalog = buildCatalog(loadCatalogConfig(), ['unrelated-group']);

    expect(catalog).toEqual({ applications: [] });
  });

  it('matches when only one of several user groups is required', () => {
    const catalog = buildCatalog(loadCatalogConfig(), ['unrelated-group', 'other-users']);

    expect(catalog.applications).toHaveLength(1);
    expect(catalog.applications[0]?.id).toBe('other');
  });

  it('includes services that inherit the application group scope', () => {
    const catalog = buildCatalog(loadCatalogConfig(), ['media-users']);

    const serviceIds = catalog.applications[0]?.services.map((service) => service.id);
    expect(serviceIds).toContain('jellyfin');
    expect(serviceIds).toContain('link-only');
  });

  it('omits services narrowed to groups the user is not in', () => {
    const catalog = buildCatalog(loadCatalogConfig(), ['media-users']);

    const serviceIds = catalog.applications[0]?.services.map((service) => service.id);
    expect(serviceIds).not.toContain('db');
    expect(catalog.applications[0]?.services).toHaveLength(2);
  });

  it('returns every application and service for adminGroup members', () => {
    const catalog = buildCatalog(loadCatalogConfig(), ['system-admins']);

    expect(catalog.applications).toHaveLength(2);
    expect(catalog.applications[0]?.services.map((service) => service.id)).toEqual([
      'jellyfin',
      'db',
      'link-only',
    ]);
    expect(catalog.applications[1]?.services.map((service) => service.id)).toEqual(['svc']);
  });

  it('derives hasContainers from declared container names and omits container names', () => {
    const catalog = buildCatalog(loadCatalogConfig(), ['system-admins']);
    const serialized = JSON.stringify(catalog);

    const jellyfin = catalog.applications[0]?.services.find((service) => service.id === 'jellyfin');
    const linkOnly = catalog.applications[0]?.services.find((service) => service.id === 'link-only');

    expect(jellyfin).toEqual({ id: 'jellyfin', name: 'Jellyfin', hasContainers: true });
    expect(linkOnly).toEqual({ id: 'link-only', name: 'Link Only', hasContainers: false });
    expect(serialized).not.toContain('jellyfin-container');
    expect(serialized).not.toContain('jellyfin-db-container');
    expect(serialized).not.toContain('other-container');
  });

  it('carries requestable through from the application config', () => {
    const catalog = buildCatalog(loadCatalogConfig(), ['media-users']);

    expect(catalog.applications[0]?.requestable).toBe(true);
    expect(catalog.applications.find((application) => application.id === 'other')).toBeUndefined();
  });
});
