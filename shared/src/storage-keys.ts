/** localStorage keys for client-only state. Nothing here is ever sent to the API. */
export const STORAGE_KEYS = {
  view: 'dashboard.view',
  flags: 'dashboard.flags',
  alertsDismissed: 'dashboard.alerts.dismissed',
  pushPrompt: 'dashboard.push.prompt',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
