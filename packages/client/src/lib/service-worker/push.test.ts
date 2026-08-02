import { afterEach, describe, expect, it, vi } from 'vitest';

import { installPushListeners } from './listeners.js';
import {
  handleNotificationClick,
  handlePush,
  pushFallbackBody,
  pushFallbackTitle,
} from './push.js';

type Listener = (event: unknown) => void;

function createWorkerScope() {
  const listeners = new Map<string, Listener>();

  const showNotification = vi.fn().mockResolvedValue(undefined);
  const matchAll = vi.fn().mockResolvedValue([]);
  const openWindow = vi.fn().mockResolvedValue(undefined);

  const scope = {
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, listener);
    },
    registration: { showNotification },
    clients: { matchAll, openWindow },
    location: { origin: 'https://dashboard.example' },
  };

  return { scope, listeners, showNotification, matchAll, openWindow };
}

async function dispatchPush(
  listeners: Map<string, Listener>,
  data: { json: () => unknown } | null,
): Promise<void> {
  const handler = listeners.get('push');
  if (!handler) {
    throw new Error('push listener was not installed');
  }

  let work: Promise<unknown> | undefined;
  handler({
    data,
    waitUntil: (promise: Promise<unknown>) => {
      work = promise;
    },
  });

  await work;
}

async function dispatchNotificationClick(
  listeners: Map<string, Listener>,
  notification: Notification,
): Promise<void> {
  const handler = listeners.get('notificationclick');
  if (!handler) {
    throw new Error('notificationclick listener was not installed');
  }

  let work: Promise<unknown> | undefined;
  handler({
    notification,
    waitUntil: (promise: Promise<unknown>) => {
      work = promise;
    },
  });

  await work;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('push listener', () => {
  it('shows one notification for a valid PushSend payload', async () => {
    const { scope, listeners, showNotification } = createWorkerScope();
    installPushListeners(scope as unknown as ServiceWorkerGlobalScope);

    await dispatchPush(listeners, {
      json: () => ({
        title: 'Maintenance tonight',
        body: 'Services restart at 02:00 UTC.',
        url: '/settings',
        topic: '*',
      }),
    });

    expect(showNotification).toHaveBeenCalledOnce();
    expect(showNotification).toHaveBeenCalledWith('Maintenance tonight', {
      body: 'Services restart at 02:00 UTC.',
      icon: '/icons/placeholder.svg',
      data: { url: '/settings' },
    });
  });

  it('shows a fallback notification for a malformed payload', async () => {
    const { scope, listeners, showNotification } = createWorkerScope();
    installPushListeners(scope as unknown as ServiceWorkerGlobalScope);

    await dispatchPush(listeners, {
      json: () => ({ title: 'Missing fields' }),
    });

    expect(showNotification).toHaveBeenCalledOnce();
    expect(showNotification).toHaveBeenCalledWith(pushFallbackTitle(), {
      body: pushFallbackBody(),
      icon: '/icons/placeholder.svg',
      data: { url: null },
    });
  });

  it('shows a fallback notification when JSON parsing fails', async () => {
    const { scope, listeners, showNotification } = createWorkerScope();
    installPushListeners(scope as unknown as ServiceWorkerGlobalScope);

    await dispatchPush(listeners, {
      json: () => {
        throw new Error('invalid json');
      },
    });

    expect(showNotification).toHaveBeenCalledOnce();
    expect(showNotification).toHaveBeenCalledWith(pushFallbackTitle(), {
      body: pushFallbackBody(),
      icon: '/icons/placeholder.svg',
      data: { url: null },
    });
  });

  it('shows a fallback notification when push data is missing', async () => {
    const registration = {
      showNotification: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;

    await handlePush(null, registration);

    expect(registration.showNotification).toHaveBeenCalledOnce();
    expect(registration.showNotification).toHaveBeenCalledWith(pushFallbackTitle(), {
      body: pushFallbackBody(),
      icon: '/icons/placeholder.svg',
      data: { url: null },
    });
  });
});

describe('notificationclick listener', () => {
  it('opens a window when no client matches the URL', async () => {
    const { scope, listeners, matchAll, openWindow } = createWorkerScope();
    installPushListeners(scope as unknown as ServiceWorkerGlobalScope);

    const close = vi.fn();
    matchAll.mockResolvedValue([]);

    await dispatchNotificationClick(listeners, {
      close,
      data: { url: '/settings' },
    } as unknown as Notification);

    expect(close).toHaveBeenCalledOnce();
    expect(matchAll).toHaveBeenCalledWith({ type: 'window', includeUncontrolled: true });
    expect(openWindow).toHaveBeenCalledWith('https://dashboard.example/settings');
  });

  it('focuses an already-open client on the notification URL', async () => {
    const focus = vi.fn().mockResolvedValue(undefined);
    const matchAll = vi.fn().mockResolvedValue([
      {
        url: 'https://dashboard.example/settings',
        focus,
      },
    ]);
    const openWindow = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();

    const clients = { matchAll, openWindow } as unknown as Clients;

    await handleNotificationClick(
      {
        close,
        data: { url: '/settings' },
      } as unknown as Notification,
      clients,
      'https://dashboard.example',
    );

    expect(close).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('opens the dashboard root when the payload URL is null', async () => {
    const { scope, listeners, matchAll, openWindow } = createWorkerScope();
    installPushListeners(scope as unknown as ServiceWorkerGlobalScope);

    const close = vi.fn();
    matchAll.mockResolvedValue([]);

    await dispatchNotificationClick(listeners, {
      close,
      data: { url: null },
    } as unknown as Notification);

    expect(openWindow).toHaveBeenCalledWith('https://dashboard.example/');
  });
});
