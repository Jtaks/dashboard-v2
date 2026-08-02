import type { StatusReport } from '@dashboard/shared';
import { describe, expect, it } from 'vitest';

import { findApplicationStatus, findServiceStatus } from './lookup.js';

const report: StatusReport = {
  collectedAt: '2026-01-01T12:00:00.000Z',
  applications: [
    {
      id: 'media',
      status: 'up',
      since: '2026-01-01T10:00:00.000Z',
      services: [
        { id: 'jellyfin', status: 'up', since: '2026-01-01T10:00:00.000Z' },
        { id: 'db', status: 'down', since: '2026-01-01T11:00:00.000Z' },
      ],
    },
  ],
};

describe('findApplicationStatus', () => {
  it('returns the application when the id is present', () => {
    expect(findApplicationStatus(report, 'media')?.status).toBe('up');
  });

  it('returns null when the id is absent', () => {
    expect(findApplicationStatus(report, 'missing')).toBeNull();
    expect(findApplicationStatus(report, '')).toBeNull();
  });
});

describe('findServiceStatus', () => {
  it('returns the service when both ids are present', () => {
    expect(findServiceStatus(report, 'media', 'db')?.status).toBe('down');
  });

  it('returns null when the application id is absent', () => {
    expect(findServiceStatus(report, 'missing', 'db')).toBeNull();
  });

  it('returns null when the service id is absent', () => {
    expect(findServiceStatus(report, 'media', 'missing')).toBeNull();
  });
});
