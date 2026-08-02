import { STORAGE_KEY_PUSH_PROMPT } from '@dashboard/shared';

const DISMISSED_VALUE = 'dismissed';

export function isPushPromptDismissed(storage: Storage = localStorage): boolean {
  try {
    return storage.getItem(STORAGE_KEY_PUSH_PROMPT) === DISMISSED_VALUE;
  } catch {
    return false;
  }
}

export function dismissPushPrompt(storage: Storage = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY_PUSH_PROMPT, DISMISSED_VALUE);
  } catch {
    // Ignore quota and privacy-mode failures.
  }
}

export function clearPushPromptDismissed(storage: Storage = localStorage): void {
  try {
    storage.removeItem(STORAGE_KEY_PUSH_PROMPT);
  } catch {
    // Ignore quota and privacy-mode failures.
  }
}
