import type { Application } from '@dashboard/shared';
import { describe, expect, it } from 'vitest';
import { applicationMatchesQuery, filterApplicationsByQuery } from './search.js';

function app(partial: Partial<Application> & Pick<Application, 'id' | 'name' | 'description'>): Application {
  return {
    url: `https://${partial.id}.example.test/`,
    icon: 'media.svg',
    requestable: false,
    services: [],
    ...partial,
  };
}

const catalog: Application[] = [
  app({ id: 'media', name: 'Media', description: 'Films and series.' }),
  app({ id: 'docs', name: 'Docs', description: 'Team documentation.' }),
  app({ id: 'mail', name: 'Mail', description: 'Group inbox.' }),
];

describe('applicationMatchesQuery', () => {
  it('matches a name fragment', () => {
    expect(applicationMatchesQuery(catalog[0]!, 'edi')).toBe(true);
    expect(applicationMatchesQuery(catalog[1]!, 'edi')).toBe(false);
  });

  it('matches a description-only fragment', () => {
    expect(applicationMatchesQuery(catalog[0]!, 'Films')).toBe(true);
    expect(applicationMatchesQuery(catalog[1]!, 'Films')).toBe(false);
    expect(applicationMatchesQuery(catalog[1]!, 'documentation')).toBe(true);
  });

  it('ignores case in both the query and the value', () => {
    expect(applicationMatchesQuery(catalog[0]!, 'MEDIA')).toBe(true);
    expect(applicationMatchesQuery(catalog[0]!, 'films')).toBe(true);
    expect(applicationMatchesQuery(catalog[1]!, 'DoCs')).toBe(true);
    expect(applicationMatchesQuery(app({ id: 'x', name: 'MEDIA', description: 'FILMS' }), 'media')).toBe(
      true,
    );
    expect(
      applicationMatchesQuery(app({ id: 'x', name: 'MEDIA', description: 'FILMS' }), 'films'),
    ).toBe(true);
  });

  it('rejects a fragment matching nothing', () => {
    expect(applicationMatchesQuery(catalog[0]!, 'xyzzy')).toBe(false);
    expect(applicationMatchesQuery(catalog[1]!, 'xyzzy')).toBe(false);
  });

  it('treats an empty or whitespace query as a match', () => {
    expect(applicationMatchesQuery(catalog[0]!, '')).toBe(true);
    expect(applicationMatchesQuery(catalog[0]!, '   ')).toBe(true);
  });
});

describe('filterApplicationsByQuery', () => {
  it('returns the full list unchanged for an empty query', () => {
    expect(filterApplicationsByQuery(catalog, '')).toBe(catalog);
    expect(filterApplicationsByQuery(catalog, '  ')).toBe(catalog);
  });

  it('narrows by name fragment', () => {
    expect(filterApplicationsByQuery(catalog, 'mai').map((a) => a.id)).toEqual(['mail']);
  });

  it('narrows by description fragment', () => {
    expect(filterApplicationsByQuery(catalog, 'inbox').map((a) => a.id)).toEqual(['mail']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterApplicationsByQuery(catalog, 'xyzzy')).toEqual([]);
  });
});
