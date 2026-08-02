import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';

import { dismissAlert, readDismissedIds, syncDismissedWithAlerts } from './storage.js';

function createDismissedAlertsStore() {
  const { subscribe, set } = writable<string[]>(browser ? readDismissedIds() : []);

  return {
    subscribe,
    syncWithAlerts(alertIds: string[]) {
      const pruned = syncDismissedWithAlerts(alertIds);
      set(pruned);
    },
    dismiss(id: string) {
      const next = dismissAlert(id);
      set(next);
    },
    getDismissed(): string[] {
      return get({ subscribe });
    },
  };
}

export const dismissedAlertsStore = createDismissedAlertsStore();
