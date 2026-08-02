import type { PushSend } from '@dashboard/shared';

import { PLACEHOLDER_ICON_PATH } from '$lib/catalog/icon.js';
import * as m from '$lib/paraglide/messages';

export const DASHBOARD_ROOT = '/';

export function isPushSend(value: unknown): value is PushSend {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.title === 'string' &&
    typeof candidate.body === 'string' &&
    (candidate.url === null || typeof candidate.url === 'string') &&
    typeof candidate.topic === 'string'
  );
}

export function pushFallbackTitle(): string {
  return m.push_fallback_title({}, { locale: 'en' });
}

export function pushFallbackBody(): string {
  return m.push_fallback_body({}, { locale: 'en' });
}

export async function readPushPayload(
  data: PushMessageData | null,
): Promise<PushSend | null> {
  if (!data) {
    return null;
  }

  try {
    const parsed: unknown = await data.json();
    return isPushSend(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function showPushNotification(
  registration: ServiceWorkerRegistration,
  payload: PushSend,
): Promise<void> {
  await registration.showNotification(payload.title, {
    body: payload.body,
    icon: PLACEHOLDER_ICON_PATH,
    data: { url: payload.url },
  });
}

export async function showFallbackNotification(
  registration: ServiceWorkerRegistration,
): Promise<void> {
  await registration.showNotification(pushFallbackTitle(), {
    body: pushFallbackBody(),
    icon: PLACEHOLDER_ICON_PATH,
    data: { url: null },
  });
}

export async function handlePush(
  data: PushMessageData | null,
  registration: ServiceWorkerRegistration,
): Promise<void> {
  const payload = await readPushPayload(data);

  if (payload) {
    await showPushNotification(registration, payload);
    return;
  }

  await showFallbackNotification(registration);
}

export function resolveNotificationTarget(
  url: string | null | undefined,
  origin: string,
): string {
  if (url === null || url === undefined) {
    return new URL(DASHBOARD_ROOT, origin).href;
  }

  return new URL(url, origin).href;
}

export async function handleNotificationClick(
  notification: Notification,
  clients: Clients,
  origin: string,
): Promise<void> {
  notification.close();

  const notificationData = notification.data as { url?: string | null } | undefined;
  const targetUrl = resolveNotificationTarget(notificationData?.url, origin);
  const windowClients = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  for (const client of windowClients) {
    if (client.url === targetUrl) {
      await client.focus();
      return;
    }
  }

  await clients.openWindow(targetUrl);
}
