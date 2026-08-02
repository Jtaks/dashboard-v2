import { writable, get, type Readable } from 'svelte/store';
import { readFlagRecord, writeFlagRecord } from './storage.js';

const flagsWritable = writable<Record<string, boolean>>(readFlagRecord());

/** Reactive map of flag name → enabled. Subscribe for in-place updates. */
export const featureFlags: Readable<Record<string, boolean>> = {
  subscribe: flagsWritable.subscribe,
};

/**
 * Resolve a flag name to a boolean.
 * Unknown names, unset keys, and malformed storage all read as off — never throws.
 */
export function isFeatureEnabled(name: string): boolean {
  return get(flagsWritable)[name] === true;
}

/** Toggle or set a flag; writes STORAGE_KEYS.flags and notifies subscribers. */
export function setFeatureFlag(name: string, enabled: boolean): void {
  flagsWritable.update((current) => {
    const next = { ...current, [name]: enabled };
    writeFlagRecord(next);
    return next;
  });
}

/** Re-read storage into the store (e.g. after another tab wrote, or in tests). */
export function reloadFeatureFlags(): void {
  flagsWritable.set(readFlagRecord());
}
