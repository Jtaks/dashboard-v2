import { describe, expect, it } from 'vitest';

import { pruneDismissedIds } from './prune.js';
import { readDismissedIds } from './storage.js';

describe('pruneDismissedIds', () => {
  it('removes an id no longer returned by the API', () => {
    expect(pruneDismissedIds(['a', 'b'], ['b'])).toEqual(['b']);
  });

  it('keeps an id still returned by the API', () => {
    expect(pruneDismissedIds(['a', 'b'], ['a', 'b', 'c'])).toEqual(['a', 'b']);
  });

  it('removes unknown ids not present in the active list', () => {
    expect(pruneDismissedIds(['stale'], ['live'])).toEqual([]);
  });
});

describe('readDismissedIds', () => {
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

  it('returns an empty list for malformed stored JSON', () => {
    const storage = createStorage({
      'dashboard.alerts.dismissed': '{not-json',
    });

    expect(readDismissedIds(storage)).toEqual([]);
  });
});
