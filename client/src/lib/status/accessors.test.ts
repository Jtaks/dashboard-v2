import type { ApplicationStatus, StatusReport } from '@dashboard/shared';
import { describe, expect, it } from 'vitest';
import { getApplicationStatus, getServiceStatus } from './accessors.js';

const mediaApp: ApplicationStatus = {
  id: 'media',
  status: 'up',
  since: '2026-01-01T00:00:00.000Z',
  services: [
    { id: 'jellyfin', status: 'up', since: '2026-01-01T00:00:00.000Z' },
    { id: 'link-only', status: null, since: null },
  ],
};

const report: StatusReport = {
  collectedAt: '2026-01-01T12:00:00.000Z',
  applications: [mediaApp],
};

describe('getApplicationStatus', () => {
  it('returns the matching application status', () => {
    expect(getApplicationStatus(report, 'media')).toEqual(mediaApp);
  });

  it('returns null when the id is absent from the report', () => {
    expect(getApplicationStatus(report, 'missing')).toBeNull();
    expect(getApplicationStatus(report, 'Media')).toBeNull();
  });

  it('returns null for a missing report', () => {
    expect(getApplicationStatus(undefined, 'media')).toBeNull();
    expect(getApplicationStatus(null, 'media')).toBeNull();
  });
});

describe('getServiceStatus', () => {
  it('returns the matching service status', () => {
    expect(getServiceStatus(report, 'media', 'jellyfin')).toEqual(mediaApp.services[0]);
  });

  it('returns a present service that has a null status reading', () => {
    expect(getServiceStatus(report, 'media', 'link-only')).toEqual({
      id: 'link-only',
      status: null,
      since: null,
    });
  });

  it('returns null when the service id is absent', () => {
    expect(getServiceStatus(report, 'media', 'missing')).toBeNull();
  });

  it('returns null when the application id is absent', () => {
    expect(getServiceStatus(report, 'missing', 'jellyfin')).toBeNull();
  });
});
