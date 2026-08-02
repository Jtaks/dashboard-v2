import { STORAGE_KEY_VIEW } from '@dashboard/shared';
import { describe, expect, it, vi } from 'vitest';

import {
  parseCatalogView,
  readCatalogView,
  writeCatalogView,
} from './view.js';

function createStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(initial));

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('parseCatalogView', () => {
  it('accepts list and grid', () => {
    expect(parseCatalogView('list')).toBe('list');
    expect(parseCatalogView('grid')).toBe('grid');
  });

  it('falls back to list for missing or unrecognised values', () => {
    expect(parseCatalogView(null)).toBe('list');
    expect(parseCatalogView('')).toBe('list');
    expect(parseCatalogView('table')).toBe('list');
  });
});

describe('readCatalogView', () => {
  it('repairs an unrecognised stored value', () => {
    const storage = createStorage({ [STORAGE_KEY_VIEW]: 'table' });

    expect(readCatalogView(storage)).toBe('list');
    expect(storage.getItem(STORAGE_KEY_VIEW)).toBe('list');
  });

  it('returns the stored value when it is valid', () => {
    const storage = createStorage({ [STORAGE_KEY_VIEW]: 'grid' });

    expect(readCatalogView(storage)).toBe('grid');
  });
});

describe('writeCatalogView', () => {
  it('persists the chosen view', () => {
    const storage = createStorage();

    writeCatalogView('grid', storage);

    expect(storage.getItem(STORAGE_KEY_VIEW)).toBe('grid');
  });

  it('ignores storage write failures', () => {
    const storage = createStorage();
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => writeCatalogView('grid', storage)).not.toThrow();
  });
});
