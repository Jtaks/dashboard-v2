import type { StatusReport } from '@dashboard/shared';
import { describe, expect, it } from 'vitest';

import type { ResolvedConfig } from '../config.js';
import { filterStatusReport } from './filter.js';

const config: ResolvedConfig = {
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

const fullReport: StatusReport = {
  collectedAt: '2024-06-01T12:00:00.000Z',
  applications: [
    {
      id: 'media',
      status: 'down',
      since: '2024-06-01T11:00:00.000Z',
      services: [
        { id: 'jellyfin', status: 'up', since: '2024-06-01T10:00:00.000Z' },
        { id: 'db', status: 'down', since: '2024-06-01T11:00:00.000Z' },
        { id: 'docs-link', status: null, since: null },
      ],
    },
    {
      id: 'docs',
      status: 'up',
      since: '2024-06-01T09:00:00.000Z',
      services: [{ id: 'wiki', status: 'up', since: '2024-06-01T09:00:00.000Z' }],
    },
  ],
};

describe('filterStatusReport', () => {
  it('keeps collectedAt from the cached collection', () => {
    const filtered = filterStatusReport(fullReport, config, ['media-users']);
    expect(filtered.collectedAt).toBe('2024-06-01T12:00:00.000Z');
  });

  it('returns only entitled applications and services', () => {
    const filtered = filterStatusReport(fullReport, config, ['media-users']);

    expect(filtered.applications.map((a) => a.id)).toEqual(['media']);
    expect(filtered.applications[0]?.services.map((s) => s.id)).toEqual([
      'jellyfin',
      'docs-link',
    ]);
  });

  it('excludes an invisible service from the application aggregate', () => {
    const filtered = filterStatusReport(fullReport, config, ['media-users']);
    const media = filtered.applications[0];

    expect(media?.services.find((s) => s.id === 'db')).toBeUndefined();
    // Full report had media=down because of db; without db the app is up.
    expect(media?.status).toBe('up');
    expect(media?.since).toBe('2024-06-01T10:00:00.000Z');
  });

  it('returns every application and service for an admin', () => {
    const filtered = filterStatusReport(fullReport, config, ['system-admins']);

    expect(filtered.applications.map((a) => a.id)).toEqual(['media', 'docs']);
    expect(filtered.applications[0]?.services.map((s) => s.id)).toEqual([
      'jellyfin',
      'db',
      'docs-link',
    ]);
    expect(filtered.applications[0]?.status).toBe('down');
  });

  it('returns an empty applications array when no group matches', () => {
    const filtered = filterStatusReport(fullReport, config, ['nobody']);
    expect(filtered).toEqual({
      collectedAt: '2024-06-01T12:00:00.000Z',
      applications: [],
    });
  });
});
