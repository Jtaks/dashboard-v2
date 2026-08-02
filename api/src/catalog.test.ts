import type { Catalog } from '@dashboard/shared';
import { describe, expect, it } from 'vitest';

import { filterCatalog } from './catalog.js';
import type { ResolvedConfig } from './config.js';

/** Fixture shaped like post-load ResolvedConfig (service groups already inherited). */
const fixture: ResolvedConfig = {
  adminGroup: 'system-admins',
  groups: ['media-users', 'media-admins', 'docs-users'],
  applications: [
    {
      id: 'media',
      name: 'Media',
      description: 'Films and series.',
      url: 'https://media.example.com',
      icon: 'media.svg',
      groups: ['media-users'],
      requestable: false,
      services: [
        {
          id: 'jellyfin',
          name: 'Jellyfin',
          containers: ['jellyfin'],
          groups: ['media-users'],
        },
        {
          id: 'db',
          name: 'Database',
          containers: ['jellyfin-db'],
          groups: ['media-admins'],
        },
        {
          id: 'docs-link',
          name: 'Docs',
          containers: [],
          groups: ['media-users'],
        },
      ],
    },
    {
      id: 'docs',
      name: 'Docs',
      description: 'Internal docs.',
      url: 'https://docs.example.com',
      icon: 'docs.svg',
      groups: ['docs-users'],
      requestable: true,
      services: [
        {
          id: 'wiki',
          name: 'Wiki',
          containers: ['wiki'],
          groups: ['docs-users'],
        },
      ],
    },
  ],
};

describe('filterCatalog', () => {
  it('returns only the application whose groups match', () => {
    const catalog = filterCatalog(fixture, ['media-users']);

    expect(catalog.applications.map((a) => a.id)).toEqual(['media']);
    expect(catalog.applications[0]?.requestable).toBe(false);
  });

  it('returns an empty applications array when no group matches', () => {
    const catalog = filterCatalog(fixture, ['unrelated']);

    expect(catalog).toEqual({ applications: [] } satisfies Catalog);
  });

  it('keeps only matching applications when the user has multiple groups', () => {
    const catalog = filterCatalog(fixture, ['docs-users', 'unrelated']);

    expect(catalog.applications.map((a) => a.id)).toEqual(['docs']);
    expect(catalog.applications[0]?.requestable).toBe(true);
  });

  it('includes services that inherit the application group scope', () => {
    const catalog = filterCatalog(fixture, ['media-users']);
    const ids = catalog.applications[0]?.services.map((s) => s.id);

    expect(ids).toContain('jellyfin');
    expect(ids).toContain('docs-link');
  });

  it('omits a narrowed service the user does not match while keeping the application', () => {
    const catalog = filterCatalog(fixture, ['media-users']);

    expect(catalog.applications).toHaveLength(1);
    expect(catalog.applications[0]?.id).toBe('media');
    expect(catalog.applications[0]?.services.map((s) => s.id)).toEqual(['jellyfin', 'docs-link']);
  });

  it('returns every application and service for an adminGroup member', () => {
    const catalog = filterCatalog(fixture, ['system-admins']);

    expect(catalog.applications.map((a) => a.id)).toEqual(['media', 'docs']);
    expect(catalog.applications[0]?.services.map((s) => s.id)).toEqual([
      'jellyfin',
      'db',
      'docs-link',
    ]);
    expect(catalog.applications[1]?.services.map((s) => s.id)).toEqual(['wiki']);
  });

  it('sets hasContainers from whether containers are declared and never exposes names', () => {
    const catalog = filterCatalog(fixture, ['media-users']);
    const services = catalog.applications[0]?.services ?? [];

    expect(services.find((s) => s.id === 'jellyfin')?.hasContainers).toBe(true);
    expect(services.find((s) => s.id === 'docs-link')?.hasContainers).toBe(false);

    const serialized = JSON.stringify(catalog);
    expect(serialized).not.toMatch(/jellyfin-db/);
    expect(serialized).not.toContain('"containers"');
  });
});
