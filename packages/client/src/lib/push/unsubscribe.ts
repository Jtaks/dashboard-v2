import { deletePushSubscription } from './api.js';
import { getPushSubscription } from './subscription.js';

export async function unsubscribeFromPush(
  registration: ServiceWorkerRegistration,
): Promise<boolean> {
  const subscription = await getPushSubscription(registration);
  if (!subscription) {
    return false;
  }

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  try {
    await deletePushSubscription(endpoint);
  } catch {
    // A failed delete still leaves the device unsubscribed locally.
  }

  return true;
}
