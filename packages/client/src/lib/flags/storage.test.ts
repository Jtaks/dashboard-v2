import { STORAGE_KEY_FLAGS } from '@dashboard/shared';
import { describe, expect, it, vi } from 'vitest';

import { readFlags, resolveFlag, writeFlag } from './storage.js';

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

describe('readFlags', () => {
  it('returns an empty object when nothing is stored', () => {
    expect(readFlags(createStorage())).toEqual({});
  });

  it('round-trips boolean values', () => {
    const storage = createStorage({
      [STORAGE_KEY_FLAGS]: JSON.stringify({ dependencySummaryPopover: true }),
    });

    expect(readFlags(storage)).toEqual({ dependencySummaryPopover: true });
  });

  it('returns an empty object for malformed JSON', () => {
    const storage = createStorage({
      [STORAGE_KEY_FLAGS]: '{not-json',
    });

    expect(readFlags(storage)).toEqual({});
  });

  it('ignores non-boolean entries', () => {
    const storage = createStorage({
      [STORAGE_KEY_FLAGS]: JSON.stringify({ dependencySummaryPopover: 'yes', other: 1 }),
    });

    expect(readFlags(storage)).toEqual({});
  });
});

describe('resolveFlag', () => {
  it('defaults unknown and unset flags to off', () => {
    expect(resolveFlag({}, 'dependencySummaryPopover')).toBe(false);
    expect(resolveFlag({ dependencySummaryPopover: false }, 'dependencySummaryPopover')).toBe(false);
    expect(resolveFlag({ other: true }, 'dependencySummaryPopover')).toBe(false);
  });

  it('returns true only for an explicit true value', () => {
    expect(resolveFlag({ dependencySummaryPopover: true }, 'dependencySummaryPopover')).toBe(true);
  });
});

describe('writeFlag', () => {
  it('persists the chosen value', () => {
    const storage = createStorage();

    writeFlag('dependencySummaryPopover', true, storage);

    expect(JSON.parse(storage.getItem(STORAGE_KEY_FLAGS)!)).toEqual({
      dependencySummaryPopover: true,
    });
  });

  it('ignores storage write failures', () => {
    const storage = createStorage();
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => writeFlag('dependencySummaryPopover', true, storage)).not.toThrow();
  });
});
