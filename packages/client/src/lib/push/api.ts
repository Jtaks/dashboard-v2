import { apiFetch, apiJson } from '$lib/api/client.js';

import type { PushSubscriptionBody } from './types.js';

export async function fetchPushPublicKey(): Promise<string> {
  const response = await apiJson<{ publicKey: string }>('/api/push/key');
  return response.publicKey;
}

export async function upsertPushSubscription(body: PushSubscriptionBody): Promise<void> {
  await apiFetch('/api/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await apiFetch('/api/push/subscriptions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
}
