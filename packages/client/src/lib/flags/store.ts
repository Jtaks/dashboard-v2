import { browser } from '$app/environment';
import { STORAGE_KEY_FLAGS } from '@dashboard/shared';
import { get, writable } from 'svelte/store';

import { readFlags, resolveFlag, writeFlag } from './storage.js';

function createFlagsStore() {
  const { subscribe, set, update } = writable<Record<string, boolean>>(
    browser ? readFlags() : {},
  );

  if (browser) {
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY_FLAGS) {
        set(readFlags());
      }
    });

    window.addEventListener('dashboard-flags-changed', () => {
      set(readFlags());
    });
  }

  return {
    subscribe,
    setFlag(name: string, value: boolean) {
      writeFlag(name, value);
      update((flags) => ({ ...flags, [name]: value }));
    },
    getFlag(name: string): boolean {
      return resolveFlag(get({ subscribe }), name);
    },
  };
}

export const flagsStore = createFlagsStore();
