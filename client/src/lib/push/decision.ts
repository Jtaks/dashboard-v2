/**
 * Pure load-time decision for push: upsert an existing subscription, offer the
 * in-page prompt, or do nothing. Source of truth for “subscribed” is always
 * `pushManager.getSubscription()`, never localStorage.
 */

export type NotificationPermissionState = 'default' | 'granted' | 'denied';

/** What the client should do after reading subscription + prompt + permission. */
export type PushLoadAction = 'upsert' | 'prompt' | 'none';

export type PushLoadDecisionInput = {
  /** False when Service Worker or PushManager is unavailable. */
  pushSupported: boolean;
  /** True when `getSubscription()` returned a subscription. */
  hasSubscription: boolean;
  /** True when `dashboard.push.prompt` is `"dismissed"`. */
  promptDismissed: boolean;
  permission: NotificationPermissionState;
};

/**
 * Decide the load-time push action.
 *
 * - Subscription present → upsert (never prompt), even if the decline key is cleared.
 * - No subscription → prompt only when supported, not dismissed, and permission is `default`.
 * - Unsupported, denied, granted-without-sub, or dismissed → none.
 */
export function decidePushLoadAction(input: PushLoadDecisionInput): PushLoadAction {
  if (!input.pushSupported) {
    return 'none';
  }

  if (input.hasSubscription) {
    return 'upsert';
  }

  if (input.permission === 'denied') {
    return 'none';
  }

  if (input.promptDismissed) {
    return 'none';
  }

  if (input.permission === 'default') {
    return 'prompt';
  }

  // permission === 'granted' but no subscription — settings (F5) offers re-subscribe.
  return 'none';
}
