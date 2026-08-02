import type { NotificationPermissionState } from './decision.js';
import {
  getPushSubscription,
  getServiceWorkerRegistration,
  isPushSupported,
} from './subscription.js';

export type PushSubscriptionStatus = 'subscribed' | 'not_subscribed' | 'blocked';

export function resolvePushSubscriptionStatus(input: {
  pushSupported: boolean;
  hasSubscription: boolean;
  notificationPermission: NotificationPermissionState;
}): PushSubscriptionStatus | null {
  if (!input.pushSupported) {
    return null;
  }

  if (input.hasSubscription) {
    return 'subscribed';
  }

  if (input.notificationPermission === 'denied') {
    return 'blocked';
  }

  return 'not_subscribed';
}

export type PushSettingsState = {
  status: PushSubscriptionStatus;
  registration: ServiceWorkerRegistration;
};

export async function loadPushSettingsState(): Promise<PushSettingsState | null> {
  if (!isPushSupported()) {
    return null;
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration?.pushManager) {
    return null;
  }

  const subscription = await getPushSubscription(registration);
  const status = resolvePushSubscriptionStatus({
    pushSupported: true,
    hasSubscription: subscription !== null,
    notificationPermission: Notification.permission,
  });

  if (!status) {
    return null;
  }

  return { status, registration };
}
