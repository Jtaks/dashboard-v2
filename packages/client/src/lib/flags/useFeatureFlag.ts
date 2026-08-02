import { derived, type Readable } from 'svelte/store';

import { flagsStore } from './store.js';
import { resolveFlag } from './storage.js';

export function useFeatureFlag(name: string): Readable<boolean> {
  return derived(flagsStore, ($flags) => resolveFlag($flags, name));
}
