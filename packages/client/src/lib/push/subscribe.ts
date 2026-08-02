import { fetchPushPublicKey, upsertPushSubscription } from './api.js';
import { clearPushPromptDismissed } from './storage.js';
import { subscriptionToBody } from './subscription.js';
import { decodeBase64Url } from './vapid.js';

export async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<boolean> {
  if (!registration.pushManager) {
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return false;
  }

  const publicKey = await fetchPushPublicKey();
  const applicationServerKey = decodeBase64Url(publicKey);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  await upsertPushSubscription(subscriptionToBody(subscription));
  clearPushPromptDismissed();
  return true;
}
