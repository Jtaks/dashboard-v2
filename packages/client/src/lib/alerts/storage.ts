import { STORAGE_KEY_ALERTS_DISMISSED } from '@dashboard/shared';

import { pruneDismissedIds } from './prune.js';

export function readDismissedIds(storage: Storage = localStorage): string[] {
  try {
    const raw = storage.getItem(STORAGE_KEY_ALERTS_DISMISSED);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

export function writeDismissedIds(ids: string[], storage: Storage = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY_ALERTS_DISMISSED, JSON.stringify(ids));
  } catch {
    // Ignore quota and privacy-mode failures.
  }
}

function dismissedIdsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function syncDismissedWithAlerts(activeIds: string[], storage: Storage = localStorage): string[] {
  const stored = readDismissedIds(storage);
  const pruned = pruneDismissedIds(stored, activeIds);

  if (!dismissedIdsEqual(stored, pruned)) {
    writeDismissedIds(pruned, storage);
  }

  return pruned;
}

export function dismissAlert(id: string, storage: Storage = localStorage): string[] {
  const dismissed = readDismissedIds(storage);

  if (dismissed.includes(id)) {
    return dismissed;
  }

  const next = [...dismissed, id];
  writeDismissedIds(next, storage);
  return next;
}
