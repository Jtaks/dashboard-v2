import { STORAGE_KEYS } from '@dashboard/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CATALOG_VIEW,
  isCatalogViewMode,
  readCatalogView,
  writeCatalogView,
} from './view.js';

type StorageMap = Map<string, string>;

function installMemoryStorage(map: StorageMap = new Map()): Storage {
  const store: Storage = {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
  vi.stubGlobal('localStorage', store);
  return store;
}

describe('isCatalogViewMode', () => {
  it('accepts list and grid only', () => {
    expect(isCatalogViewMode('list')).toBe(true);
    expect(isCatalogViewMode('grid')).toBe(true);
    expect(isCatalogViewMode('')).toBe(false);
    expect(isCatalogViewMode('cards')).toBe(false);
    expect(isCatalogViewMode(null)).toBe(false);
  });
});

describe('readCatalogView / writeCatalogView', () => {
  let map: StorageMap;

  beforeEach(() => {
    map = new Map();
    installMemoryStorage(map);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes and reads dashboard.view through STORAGE_KEYS', () => {
    writeCatalogView('grid');
    expect(map.get(STORAGE_KEYS.view)).toBe('grid');
    expect(map.has('dashboard.view')).toBe(true);
    expect(readCatalogView()).toBe('grid');

    writeCatalogView('list');
    expect(map.get(STORAGE_KEYS.view)).toBe('list');
    expect(readCatalogView()).toBe('list');
  });

  it('falls back to list and repairs when the key is missing', () => {
    expect(map.has(STORAGE_KEYS.view)).toBe(false);
    expect(readCatalogView()).toBe(DEFAULT_CATALOG_VIEW);
    expect(map.get(STORAGE_KEYS.view)).toBe('list');
  });

  it('falls back to list and repairs empty and unrecognised values', () => {
    map.set(STORAGE_KEYS.view, '');
    expect(readCatalogView()).toBe('list');
    expect(map.get(STORAGE_KEYS.view)).toBe('list');

    map.set(STORAGE_KEYS.view, 'cards');
    expect(readCatalogView()).toBe('list');
    expect(map.get(STORAGE_KEYS.view)).toBe('list');

    map.set(STORAGE_KEYS.view, 'LIST');
    expect(readCatalogView()).toBe('list');
    expect(map.get(STORAGE_KEYS.view)).toBe('list');
  });

  it('ignores localStorage that rejects writes', () => {
    const rejecting: Storage = {
      length: 0,
      clear() {},
      getItem() {
        return 'grid';
      },
      key() {
        return null;
      },
      removeItem() {},
      setItem() {
        throw new DOMException('QuotaExceededError');
      },
    };
    vi.stubGlobal('localStorage', rejecting);

    expect(() => writeCatalogView('list')).not.toThrow();
    expect(readCatalogView()).toBe('grid');
  });

  it('falls back to list when localStorage getItem throws', () => {
    vi.stubGlobal('localStorage', {
      length: 0,
      clear() {},
      getItem() {
        throw new Error('denied');
      },
      key() {
        return null;
      },
      removeItem() {},
      setItem() {},
    } satisfies Storage);

    expect(readCatalogView()).toBe('list');
  });
});
