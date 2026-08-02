import { STORAGE_KEY_FLAGS } from '@dashboard/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flagsStore } from './store.js';

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

describe('flagsStore', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
  });

  it('defaults an unset flag to off', () => {
    expect(flagsStore.getFlag('dependencySummaryPopover')).toBe(false);
    expect(flagsStore.getFlag('unknownFlag')).toBe(false);
  });

  it('round-trips a written value through storage', () => {
    flagsStore.setFlag('dependencySummaryPopover', true);

    expect(flagsStore.getFlag('dependencySummaryPopover')).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_FLAGS)!)).toEqual({
      dependencySummaryPopover: true,
    });
  });

  it('notifies subscribers when a flag changes', () => {
    const snapshots: Record<string, boolean>[] = [];
    const unsubscribe = flagsStore.subscribe((flags) => {
      snapshots.push({ ...flags });
    });

    flagsStore.setFlag('dependencySummaryPopover', true);

    expect(snapshots.at(-1)).toEqual({ dependencySummaryPopover: true });
    unsubscribe();
  });

  it('updates subscribers without a reload when toggled again', () => {
    let latest = false;
    const unsubscribe = flagsStore.subscribe((flags) => {
      latest = flags.dependencySummaryPopover === true;
    });

    flagsStore.setFlag('dependencySummaryPopover', true);
    expect(latest).toBe(true);

    flagsStore.setFlag('dependencySummaryPopover', false);
    expect(latest).toBe(false);
    unsubscribe();
  });
});
