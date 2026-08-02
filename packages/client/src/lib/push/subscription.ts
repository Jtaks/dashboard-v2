import type { PushSubscriptionBody } from './types.js';

export function isPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof Notification !== 'undefined'
  );
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) {
    return null;
  }

  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function getPushSubscription(
  registration: ServiceWorkerRegistration | null = null,
): Promise<PushSubscription | null> {
  const resolvedRegistration = registration ?? (await getServiceWorkerRegistration());
  if (!resolvedRegistration?.pushManager) {
    return null;
  }

  try {
    return await resolvedRegistration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export function subscriptionToBody(subscription: PushSubscription): PushSubscriptionBody {
  const json = subscription.toJSON();

  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Push subscription is missing required fields');
  }

  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
}
