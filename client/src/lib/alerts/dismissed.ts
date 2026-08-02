import { STORAGE_KEYS } from '@dashboard/shared';
import { parseDismissedIds, pruneDismissedIds } from './prune.js';

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

/** Read dismissed alert ids from `dashboard.alerts.dismissed`. */
export function readDismissedIds(): string[] {
  const store = storage();
  if (!store) {
    return [];
  }

  try {
    return parseDismissedIds(store.getItem(STORAGE_KEYS.alertsDismissed));
  } catch {
    return [];
  }
}

/** Persist dismissed ids. Write failures are ignored (quota, private mode). */
export function writeDismissedIds(ids: string[]): void {
  const store = storage();
  if (!store) {
    return;
  }

  try {
    store.setItem(STORAGE_KEYS.alertsDismissed, JSON.stringify(ids));
  } catch {
    // localStorage may reject writes; in-memory state still holds the value.
  }
}

/**
 * Append an alert id to the dismissed list.
 * Returns the updated list (deduped). Does not refetch.
 */
export function dismissAlertId(id: string): string[] {
  const current = readDismissedIds();
  if (current.includes(id)) {
    return current;
  }
  const next = [...current, id];
  writeDismissedIds(next);
  return next;
}

/**
 * Prune stored dismissals against a live `/api/alerts` response and write back.
 * Returns the pruned list used for filtering the banner.
 */
export function syncDismissedWithLiveAlerts(liveAlertIds: readonly string[]): string[] {
  const stored = readDismissedIds();
  const pruned = pruneDismissedIds(stored, liveAlertIds);
  if (pruned.length !== stored.length || pruned.some((id, i) => id !== stored[i])) {
    writeDismissedIds(pruned);
  }
  return pruned;
}
