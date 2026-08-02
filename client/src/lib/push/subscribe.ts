import { apiFetch } from '$lib/api/client.js';
import { clearPushPromptDismissed } from './prompt-storage.js';
import { decodeBase64Url } from './vapid-key.js';

/** Body shape accepted by `POST /api/push/subscriptions` (PushSubscription.toJSON()). */
export type PushSubscriptionUpsertBody = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type PushKeyResponse = {
  publicKey: string;
};

/** True when this browser can register for Web Push. */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

/** Wait for the active service worker registration (SvelteKit registers it). */
export async function getPushRegistration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready;
}

/**
 * Source of truth for whether this device is subscribed.
 * Never read subscription state from localStorage.
 */
export async function getPushSubscription(
  registration?: ServiceWorkerRegistration,
): Promise<PushSubscription | null> {
  const reg = registration ?? (await getPushRegistration());
  return reg.pushManager.getSubscription();
}

function subscriptionToUpsertBody(subscription: PushSubscription): PushSubscriptionUpsertBody {
  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error('push_subscription_incomplete');
  }

  return { endpoint, keys: { p256dh, auth } };
}

/** Upsert this device and refresh topics via live Remote-Groups on the server. */
export async function upsertPushSubscription(subscription: PushSubscription): Promise<void> {
  const body = subscriptionToUpsertBody(subscription);
  await apiFetch<void>('/api/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Fetch the VAPID public key; never inlined in the client bundle. */
export async function fetchPushPublicKey(): Promise<string> {
  const response = await apiFetch<PushKeyResponse>('/api/push/key');
  if (!response?.publicKey) {
    throw new Error('push_key_missing');
  }
  return response.publicKey;
}

export type SubscribeToPushOptions = {
  /**
   * When true (settings subscribe), clear `dashboard.push.prompt` so a prior
   * decline does not block future load-time offers after an unsubscribe.
   */
  clearDismissed?: boolean;
  registration?: ServiceWorkerRegistration;
};

/**
 * Shared subscribe path for the F4 prompt and F5 settings.
 * Requests permission, fetches the VAPID key, subscribes, and upserts.
 */
export async function subscribeToPush(
  options: SubscribeToPushOptions = {},
): Promise<PushSubscription> {
  if (!isPushSupported()) {
    throw new Error('push_unsupported');
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error('push_permission_denied');
  }

  if (options.clearDismissed) {
    clearPushPromptDismissed();
  }

  const registration = options.registration ?? (await getPushRegistration());
  const publicKey = await fetchPushPublicKey();
  const applicationServerKey = decodeBase64Url(publicKey);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  await upsertPushSubscription(subscription);
  return subscription;
}

/** Remove the server row for an endpoint (F5 unsubscribe). Absent is still success. */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  await apiFetch<void>('/api/push/subscriptions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
}

/**
 * Unsubscribe this device: capture the endpoint, drop the browser subscription,
 * then DELETE the server row. A failed DELETE still leaves the device
 * local-unsubscribed; orphaned rows are cleared by 404/410 handling on send.
 */
export async function unsubscribeFromPush(
  subscription?: PushSubscription | null,
): Promise<void> {
  const sub = subscription === undefined ? await getPushSubscription() : subscription;
  if (!sub) {
    return;
  }

  const endpoint = sub.endpoint;
  await sub.unsubscribe();

  try {
    await deletePushSubscription(endpoint);
  } catch {
    // Local unsubscribe already succeeded; server cleanup is best-effort.
  }
}
