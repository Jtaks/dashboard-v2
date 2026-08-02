import { STORAGE_KEYS } from '@dashboard/shared';

const DISMISSED = 'dismissed';

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

/** True when the user declined the load-time prompt (`dashboard.push.prompt`). */
export function isPushPromptDismissed(): boolean {
  const store = storage();
  if (!store) {
    return false;
  }

  try {
    return store.getItem(STORAGE_KEYS.pushPrompt) === DISMISSED;
  } catch {
    return false;
  }
}

/** Persist a decline so the prompt is not offered again on this device. */
export function dismissPushPrompt(): void {
  const store = storage();
  if (!store) {
    return;
  }

  try {
    store.setItem(STORAGE_KEYS.pushPrompt, DISMISSED);
  } catch {
    // localStorage may reject writes; in-memory UI still hides the prompt.
  }
}

/**
 * Clear a prior decline (settings subscribe path). Safe when the key is absent.
 */
export function clearPushPromptDismissed(): void {
  const store = storage();
  if (!store) {
    return;
  }

  try {
    store.removeItem(STORAGE_KEYS.pushPrompt);
  } catch {
    // Ignore write failures.
  }
}
