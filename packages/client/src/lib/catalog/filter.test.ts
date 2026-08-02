import type { Application } from '@dashboard/shared';
import { describe, expect, it } from 'vitest';

import { applicationMatchesSearch, filterApplications } from './filter.js';

const applications: Application[] = [
  {
    id: 'alpha',
    name: 'Alpha App',
    description: 'Runs the alpha service',
    url: 'https://alpha.example/',
    icon: 'alpha.svg',
    requestable: false,
    services: [],
  },
  {
    id: 'beta',
    name: 'Beta Portal',
    description: 'Second application',
    url: 'https://beta.example/',
    icon: 'beta.svg',
    requestable: false,
    services: [],
  },
];

describe('applicationMatchesSearch', () => {
  it('matches a fragment in the name', () => {
    expect(applicationMatchesSearch(applications[0], 'alpha')).toBe(true);
  });

  it('matches a fragment in the description', () => {
    expect(applicationMatchesSearch(applications[1], 'second')).toBe(true);
  });

  it('ignores case in the query and the value', () => {
    expect(applicationMatchesSearch(applications[0], 'ALPHA')).toBe(true);
    expect(applicationMatchesSearch(applications[1], 'BETA PORTAL')).toBe(true);
  });

  it('returns false when nothing matches', () => {
    expect(applicationMatchesSearch(applications[0], 'missing')).toBe(false);
  });

  it('treats an empty query as matching everything', () => {
    expect(applicationMatchesSearch(applications[0], '')).toBe(true);
    expect(applicationMatchesSearch(applications[0], '   ')).toBe(true);
  });
});

describe('filterApplications', () => {
  it('returns only matching applications', () => {
    expect(filterApplications(applications, 'alpha')).toEqual([applications[0]]);
    expect(filterApplications(applications, 'second')).toEqual([applications[1]]);
  });

  it('returns the full list unchanged for an empty query', () => {
    expect(filterApplications(applications, '')).toEqual(applications);
    expect(filterApplications(applications, '   ')).toEqual(applications);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterApplications(applications, 'missing')).toEqual([]);
  });
});
