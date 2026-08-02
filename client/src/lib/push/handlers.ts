import type { PushSend } from '@dashboard/shared';
import {
  PUSH_FALLBACK_BODY,
  PUSH_FALLBACK_TITLE,
  PUSH_NOTIFICATION_ICON,
} from './fallback.js';
import { parsePushSend } from './parse.js';

/** Minimal SW surface the handlers need — injectable for Vitest. */
export type PushWorkerScope = {
  registration: {
    showNotification(
      title: string,
      options?: NotificationOptions,
    ): Promise<void>;
  };
  clients: {
    matchAll(options?: ClientQueryOptions): Promise<ReadonlyArray<WindowClientLike>>;
    openWindow(url: string): Promise<WindowClientLike | null>;
  };
  location: { origin: string };
};

export type WindowClientLike = {
  url: string;
  focus(): Promise<WindowClientLike>;
};

type WaitUntilEvent = {
  waitUntil(promise: Promise<unknown>): void;
};

export type PushHandlerEvent = WaitUntilEvent & {
  data: { json(): unknown } | null;
};

export type NotificationClickHandlerEvent = WaitUntilEvent & {
  notification: {
    data?: { url?: string | null } | null;
    close(): void;
  };
};

/** Resolve a payload URL (or null) to an absolute URL under the worker origin. */
export function resolveNotificationUrl(url: string | null | undefined, origin: string): string {
  if (url == null) {
    return new URL('/', origin).href;
  }
  return new URL(url, origin).href;
}

async function showPushNotification(
  scope: PushWorkerScope,
  title: string,
  body: string,
  url: string | null,
): Promise<void> {
  await scope.registration.showNotification(title, {
    body,
    icon: PUSH_NOTIFICATION_ICON,
    data: { url },
  });
}

async function deliverPush(scope: PushWorkerScope, event: PushHandlerEvent): Promise<void> {
  const payload: PushSend | null = parsePushSend(event.data);
  if (!payload) {
    await showPushNotification(scope, PUSH_FALLBACK_TITLE, PUSH_FALLBACK_BODY, null);
    return;
  }
  await showPushNotification(scope, payload.title, payload.body, payload.url);
}

async function openFromNotification(
  scope: PushWorkerScope,
  event: NotificationClickHandlerEvent,
): Promise<void> {
  event.notification.close();
  const rawUrl = event.notification.data?.url ?? null;
  const targetUrl = resolveNotificationUrl(rawUrl, scope.location.origin);

  const windowClients = await scope.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  const existing = windowClients.find((client) => client.url === targetUrl);
  if (existing) {
    await existing.focus();
    return;
  }
  await scope.clients.openWindow(targetUrl);
}

/** Handle a `push` event; work is extended via `event.waitUntil`. */
export function handlePush(scope: PushWorkerScope, event: PushHandlerEvent): void {
  event.waitUntil(deliverPush(scope, event));
}

/** Handle a `notificationclick` event; work is extended via `event.waitUntil`. */
export function handleNotificationClick(
  scope: PushWorkerScope,
  event: NotificationClickHandlerEvent,
): void {
  event.waitUntil(openFromNotification(scope, event));
}

/** Register push and notificationclick listeners on a worker-like global. */
export function registerPushHandlers(
  scope: PushWorkerScope & {
    addEventListener(type: 'push', listener: (event: PushHandlerEvent) => void): void;
    addEventListener(
      type: 'notificationclick',
      listener: (event: NotificationClickHandlerEvent) => void,
    ): void;
  },
): void {
  scope.addEventListener('push', (event) => handlePush(scope, event));
  scope.addEventListener('notificationclick', (event) =>
    handleNotificationClick(scope, event),
  );
}
