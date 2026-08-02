import { STORAGE_KEYS } from '@dashboard/shared';

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * Read `dashboard.flags` as `Record<string, boolean>`.
 * Missing key, malformed JSON, or non-object values yield `{}` and never throw.
 */
export function readFlagRecord(): Record<string, boolean> {
  const store = storage();
  if (!store) {
    return {};
  }

  try {
    const raw = store.getItem(STORAGE_KEYS.flags);
    if (raw == null || raw === '') {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const result: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'boolean') {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

/** Persist the flag record. Write failures are ignored (quota, private mode). */
export function writeFlagRecord(flags: Record<string, boolean>): void {
  const store = storage();
  if (!store) {
    return;
  }

  try {
    store.setItem(STORAGE_KEYS.flags, JSON.stringify(flags));
  } catch {
    // localStorage may reject writes; in-memory store still holds the value.
  }
}
