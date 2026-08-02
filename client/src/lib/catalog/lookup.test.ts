import type { Application, Catalog } from '@dashboard/shared';
import { describe, expect, it } from 'vitest';
import { findApplicationById } from './lookup.js';

const media: Application = {
  id: 'media',
  name: 'Media',
  description: 'Films and series.',
  url: 'https://media.example.test/',
  icon: 'media.svg',
  requestable: false,
  services: [],
};

const docs: Application = {
  id: 'docs',
  name: 'Docs',
  description: 'Team documentation.',
  url: 'https://docs.example.test/',
  icon: 'docs.svg',
  requestable: true,
  services: [],
};

const catalog: Catalog = { applications: [media, docs] };

describe('findApplicationById', () => {
  it('returns the matching application', () => {
    expect(findApplicationById(catalog, 'media')).toEqual(media);
    expect(findApplicationById(catalog, 'docs')).toEqual(docs);
  });

  it('returns undefined when the id is not in the catalog', () => {
    expect(findApplicationById(catalog, 'unknown')).toBeUndefined();
    expect(findApplicationById(catalog, 'Media')).toBeUndefined();
  });

  it('returns undefined for missing catalog or empty id', () => {
    expect(findApplicationById(undefined, 'media')).toBeUndefined();
    expect(findApplicationById(null, 'media')).toBeUndefined();
    expect(findApplicationById(catalog, undefined)).toBeUndefined();
    expect(findApplicationById(catalog, null)).toBeUndefined();
    expect(findApplicationById(catalog, '')).toBeUndefined();
  });
});
