import type { FeatureFlag } from '@dashboard/shared';
import { STORAGE_KEYS } from '@dashboard/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FEATURE_FLAGS,
  STATUS_SUMMARY_POPOVER,
  visibleFlags,
} from './registry.js';
import {
  featureFlags,
  isFeatureEnabled,
  reloadFeatureFlags,
  setFeatureFlag,
} from './store.js';
import { readFlagRecord, writeFlagRecord } from './storage.js';

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

describe('FEATURE_FLAGS registry', () => {
  it('declares the C4 status-summary-popover flag as non-admin', () => {
    const entry = FEATURE_FLAGS.find((f) => f.feature === STATUS_SUMMARY_POPOVER);
    expect(entry).toEqual({
      feature: 'status-summary-popover',
      description: 'flag_status_summary_popover',
      admin: false,
    });
  });

  it('does not list list/grid view among flags', () => {
    const names = FEATURE_FLAGS.map((f) => f.feature);
    expect(names).not.toContain('list');
    expect(names).not.toContain('grid');
    expect(names).not.toContain('view');
    expect(names).not.toContain('dashboard.view');
  });
});

describe('visibleFlags', () => {
  const fixture: FeatureFlag[] = [
    { feature: 'user-flag', description: 'd1', admin: false },
    { feature: 'admin-flag', description: 'd2', admin: true },
  ];

  it('hides admin flags for a non-admin session', () => {
    expect(visibleFlags(fixture, false).map((f) => f.feature)).toEqual(['user-flag']);
  });

  it('lists all flags for an admin session', () => {
    expect(visibleFlags(fixture, true).map((f) => f.feature)).toEqual([
      'user-flag',
      'admin-flag',
    ]);
  });

  it('filters the real registry by session admin', () => {
    const forUser = visibleFlags(FEATURE_FLAGS, false);
    const forAdmin = visibleFlags(FEATURE_FLAGS, true);

    expect(forUser.every((f) => f.admin === false)).toBe(true);
    expect(forAdmin.length).toBeGreaterThan(forUser.length);
    expect(forAdmin.some((f) => f.admin)).toBe(true);
    expect(forUser.some((f) => f.feature === STATUS_SUMMARY_POPOVER)).toBe(true);
  });
});

describe('readFlagRecord / writeFlagRecord', () => {
  let map: StorageMap;

  beforeEach(() => {
    map = new Map();
    installMemoryStorage(map);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes and reads through STORAGE_KEYS.flags', () => {
    writeFlagRecord({ [STATUS_SUMMARY_POPOVER]: true });
    expect(map.get(STORAGE_KEYS.flags)).toBe(
      JSON.stringify({ [STATUS_SUMMARY_POPOVER]: true }),
    );
    expect(readFlagRecord()).toEqual({ [STATUS_SUMMARY_POPOVER]: true });
  });

  it('returns {} when the key is absent', () => {
    expect(readFlagRecord()).toEqual({});
  });

  it('returns {} for malformed JSON without throwing', () => {
    map.set(STORAGE_KEYS.flags, '{not-json');
    expect(() => readFlagRecord()).not.toThrow();
    expect(readFlagRecord()).toEqual({});
  });

  it('returns {} for non-object JSON', () => {
    map.set(STORAGE_KEYS.flags, 'true');
    expect(readFlagRecord()).toEqual({});
    map.set(STORAGE_KEYS.flags, '[]');
    expect(readFlagRecord()).toEqual({});
    map.set(STORAGE_KEYS.flags, 'null');
    expect(readFlagRecord()).toEqual({});
  });

  it('keeps only boolean entries from a mixed object', () => {
    map.set(
      STORAGE_KEYS.flags,
      JSON.stringify({ ok: true, bad: 'yes', also: 1, off: false }),
    );
    expect(readFlagRecord()).toEqual({ ok: true, off: false });
  });
});

describe('isFeatureEnabled / setFeatureFlag store', () => {
  let map: StorageMap;

  beforeEach(() => {
    map = new Map();
    installMemoryStorage(map);
    reloadFeatureFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults unknown and unset flags to off', () => {
    expect(isFeatureEnabled('missing')).toBe(false);
    expect(isFeatureEnabled(STATUS_SUMMARY_POPOVER)).toBe(false);
  });

  it('round-trips a written value and notifies subscribers', () => {
    const seen: boolean[] = [];
    const unsubscribe = featureFlags.subscribe((flags) => {
      seen.push(flags[STATUS_SUMMARY_POPOVER] === true);
    });

    setFeatureFlag(STATUS_SUMMARY_POPOVER, true);
    expect(isFeatureEnabled(STATUS_SUMMARY_POPOVER)).toBe(true);
    expect(JSON.parse(map.get(STORAGE_KEYS.flags)!)).toEqual({
      [STATUS_SUMMARY_POPOVER]: true,
    });

    setFeatureFlag(STATUS_SUMMARY_POPOVER, false);
    expect(isFeatureEnabled(STATUS_SUMMARY_POPOVER)).toBe(false);

    unsubscribe();
    // Initial load (false) + true + false
    expect(seen).toEqual([false, true, false]);
  });

  it('treats malformed storage as off via isFeatureEnabled', () => {
    map.set(STORAGE_KEYS.flags, '<<<');
    reloadFeatureFlags();
    expect(isFeatureEnabled(STATUS_SUMMARY_POPOVER)).toBe(false);
    expect(isFeatureEnabled('anything')).toBe(false);
  });

  it('does not throw when localStorage rejects writes', () => {
    vi.stubGlobal('localStorage', {
      length: 0,
      clear() {},
      getItem() {
        return null;
      },
      key() {
        return null;
      },
      removeItem() {},
      setItem() {
        throw new DOMException('QuotaExceededError');
      },
    } satisfies Storage);
    reloadFeatureFlags();

    expect(() => setFeatureFlag(STATUS_SUMMARY_POPOVER, true)).not.toThrow();
    expect(isFeatureEnabled(STATUS_SUMMARY_POPOVER)).toBe(true);
  });
});
