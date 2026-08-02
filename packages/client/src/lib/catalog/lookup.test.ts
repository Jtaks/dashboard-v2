import type { Application, Catalog } from '@dashboard/shared';
import { describe, expect, it } from 'vitest';

import { findApplicationInCatalog } from './lookup.js';

const application: Application = {
  id: 'app-one',
  name: 'App One',
  description: 'First application',
  url: 'https://app-one.example/',
  icon: 'app-one.svg',
  requestable: false,
  services: [],
};

const catalog: Catalog = {
  applications: [
    application,
    {
      id: 'app-two',
      name: 'App Two',
      description: 'Second application',
      url: 'https://app-two.example/',
      icon: 'app-two.svg',
      requestable: false,
      services: [],
    },
  ],
};

describe('findApplicationInCatalog', () => {
  it('returns the application when the id is present', () => {
    expect(findApplicationInCatalog(catalog, 'app-one')).toEqual(application);
    expect(findApplicationInCatalog(catalog, 'app-two')?.name).toBe('App Two');
  });

  it('returns undefined when the id is absent', () => {
    expect(findApplicationInCatalog(catalog, 'missing')).toBeUndefined();
    expect(findApplicationInCatalog(catalog, '')).toBeUndefined();
  });
});
