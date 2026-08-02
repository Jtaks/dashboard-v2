import { upsertPushSubscription } from './api.js';
import { resolvePushLoadAction } from './decision.js';
import { isPushPromptDismissed } from './storage.js';
import {
  getPushSubscription,
  getServiceWorkerRegistration,
  isPushSupported,
  subscriptionToBody,
} from './subscription.js';

export type PushLoadResult = {
  action: ReturnType<typeof resolvePushLoadAction>;
  showPrompt: boolean;
  registration: ServiceWorkerRegistration | null;
};

export async function runPushOnLoad(storage: Storage = localStorage): Promise<PushLoadResult> {
  const pushCapable = isPushSupported();
  const registration = pushCapable ? await getServiceWorkerRegistration() : null;
  const pushSupported = Boolean(registration?.pushManager);
  const subscription = pushSupported ? await getPushSubscription(registration) : null;

  const action = resolvePushLoadAction({
    pushSupported,
    hasSubscription: subscription !== null,
    notificationPermission: Notification.permission,
    promptDismissed: isPushPromptDismissed(storage),
  });

  if (action === 'upsert' && subscription) {
    await upsertPushSubscription(subscriptionToBody(subscription));
    return { action, showPrompt: false, registration };
  }

  return {
    action,
    showPrompt: action === 'prompt',
    registration: action === 'prompt' ? registration : null,
  };
}
