import { writable, type Readable } from 'svelte/store';
import { decidePushLoadAction, type PushLoadAction } from './decision.js';
import { isPushPromptDismissed } from './prompt-storage.js';
import {
  getPushRegistration,
  getPushSubscription,
  isPushSupported,
  upsertPushSubscription,
} from './subscribe.js';

export type PushClientState = {
  /** False until the first resolve finishes (or support is known absent). */
  ready: boolean;
  supported: boolean;
  /** Live browser subscription; null when unsubscribed or unsupported. */
  subscription: PushSubscription | null;
  permission: NotificationPermission | 'unsupported';
  /** Last load-time action taken or offered. */
  lastAction: PushLoadAction | null;
};

const initial: PushClientState = {
  ready: false,
  supported: false,
  subscription: null,
  permission: 'unsupported',
  lastAction: null,
};

const pushStateWritable = writable<PushClientState>(initial);

/** Reactive push subscription state for the shell and settings (F5). */
export const pushState: Readable<PushClientState> = {
  subscribe: pushStateWritable.subscribe,
};

function readPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

function publish(
  patch: Partial<PushClientState> & Pick<PushClientState, 'subscription' | 'permission'>,
): void {
  pushStateWritable.update((current) => ({
    ...current,
    ...patch,
    ready: true,
  }));
}

/**
 * Resolve subscription from `pushManager.getSubscription()`, upsert when present,
 * and return the load action (including whether the prompt should be shown).
 */
export async function resolvePushOnLoad(): Promise<PushLoadAction> {
  if (!isPushSupported()) {
    publish({
      supported: false,
      subscription: null,
      permission: 'unsupported',
      lastAction: 'none',
    });
    return 'none';
  }

  const registration = await getPushRegistration();
  const subscription = await getPushSubscription(registration);
  const permission = Notification.permission;
  const action = decidePushLoadAction({
    pushSupported: true,
    hasSubscription: subscription !== null,
    promptDismissed: isPushPromptDismissed(),
    permission,
  });

  if (action === 'upsert' && subscription) {
    await upsertPushSubscription(subscription);
  }

  publish({
    supported: true,
    subscription,
    permission,
    lastAction: action,
  });

  return action;
}

/** Refresh store from the browser after subscribe/unsubscribe (F5). */
export async function refreshPushState(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    publish({
      supported: false,
      subscription: null,
      permission: 'unsupported',
      lastAction: null,
    });
    return null;
  }

  const subscription = await getPushSubscription();
  publish({
    supported: true,
    subscription,
    permission: readPermission(),
    lastAction: null,
  });
  return subscription;
}

/** Update store after a successful subscribe without re-reading (optional). */
export function setPushSubscriptionState(subscription: PushSubscription | null): void {
  publish({
    supported: isPushSupported(),
    subscription,
    permission: readPermission(),
    lastAction: null,
  });
}
