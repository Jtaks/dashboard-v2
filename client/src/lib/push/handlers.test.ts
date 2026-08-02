import { describe, expect, it, vi } from 'vitest';
import { PUSH_FALLBACK_BODY, PUSH_FALLBACK_TITLE, PUSH_NOTIFICATION_ICON } from './fallback.js';
import {
  handleNotificationClick,
  handlePush,
  registerPushHandlers,
  resolveNotificationUrl,
  type PushWorkerScope,
  type WindowClientLike,
} from './handlers.js';
import { isPushSend, parsePushSend } from './parse.js';

const ORIGIN = 'https://dashboard.test';

function createScope(overrides: Partial<PushWorkerScope> = {}) {
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const matchAll = vi.fn().mockResolvedValue([] as WindowClientLike[]);
  const openWindow = vi.fn().mockResolvedValue(null);
  const scope: PushWorkerScope = {
    registration: { showNotification },
    clients: { matchAll, openWindow },
    location: { origin: ORIGIN },
    ...overrides,
  };
  return { scope, showNotification, matchAll, openWindow };
}

function waitUntilEvent() {
  const pending: Promise<unknown>[] = [];
  return {
    waitUntil: vi.fn((promise: Promise<unknown>) => {
      pending.push(promise);
    }),
    flush: async () => {
      await Promise.all(pending);
    },
  };
}

function validPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    title: 'Maintenance',
    body: 'API restart in 5 minutes',
    url: '/settings',
    topic: '*',
    ...overrides,
  };
}

describe('parsePushSend', () => {
  it('accepts a valid PushSend object', () => {
    const payload = validPayload();
    expect(isPushSend(payload)).toBe(true);
    expect(parsePushSend({ json: () => payload })).toEqual(payload);
  });

  it('rejects non-JSON without throwing', () => {
    expect(
      parsePushSend({
        json: () => {
          throw new SyntaxError('Unexpected token');
        },
      }),
    ).toBeNull();
  });

  it('rejects a shape missing required fields', () => {
    expect(parsePushSend({ json: () => ({ title: 'only' }) })).toBeNull();
  });

  it('rejects null event data', () => {
    expect(parsePushSend(null)).toBeNull();
  });
});

describe('resolveNotificationUrl', () => {
  it('maps null to the dashboard root', () => {
    expect(resolveNotificationUrl(null, ORIGIN)).toBe(`${ORIGIN}/`);
  });

  it('resolves a relative path against the origin', () => {
    expect(resolveNotificationUrl('/settings', ORIGIN)).toBe(`${ORIGIN}/settings`);
  });
});

describe('handlePush', () => {
  it('shows one notification for a valid PushSend payload', async () => {
    const { scope, showNotification } = createScope();
    const event = waitUntilEvent();
    const payload = validPayload();

    handlePush(scope, {
      data: { json: () => payload },
      waitUntil: event.waitUntil,
    });
    await event.flush();

    expect(event.waitUntil).toHaveBeenCalledOnce();
    expect(showNotification).toHaveBeenCalledOnce();
    expect(showNotification).toHaveBeenCalledWith('Maintenance', {
      body: 'API restart in 5 minutes',
      icon: PUSH_NOTIFICATION_ICON,
      data: { url: '/settings' },
    });
  });

  it('shows one fallback notification for a malformed payload', async () => {
    const { scope, showNotification } = createScope();
    const event = waitUntilEvent();

    handlePush(scope, {
      data: {
        json: () => {
          throw new SyntaxError('not json');
        },
      },
      waitUntil: event.waitUntil,
    });
    await event.flush();

    expect(showNotification).toHaveBeenCalledOnce();
    expect(showNotification).toHaveBeenCalledWith(PUSH_FALLBACK_TITLE, {
      body: PUSH_FALLBACK_BODY,
      icon: PUSH_NOTIFICATION_ICON,
      data: { url: null },
    });
  });

  it('shows one fallback when the payload shape does not match PushSend', async () => {
    const { scope, showNotification } = createScope();
    const event = waitUntilEvent();

    handlePush(scope, {
      data: { json: () => ({ title: 1, body: true }) },
      waitUntil: event.waitUntil,
    });
    await event.flush();

    expect(showNotification).toHaveBeenCalledOnce();
    expect(showNotification.mock.calls[0]?.[0]).toBe(PUSH_FALLBACK_TITLE);
  });
});

describe('handleNotificationClick', () => {
  it('focuses an already-open client on the notification URL', async () => {
    const focus = vi.fn().mockResolvedValue(undefined);
    const existing: WindowClientLike = {
      url: `${ORIGIN}/settings`,
      focus: focus as WindowClientLike['focus'],
    };
    const { scope, matchAll, openWindow } = createScope();
    matchAll.mockResolvedValue([existing]);
    const event = waitUntilEvent();
    const close = vi.fn();

    handleNotificationClick(scope, {
      notification: { data: { url: '/settings' }, close },
      waitUntil: event.waitUntil,
    });
    await event.flush();

    expect(close).toHaveBeenCalledOnce();
    expect(event.waitUntil).toHaveBeenCalledOnce();
    expect(matchAll).toHaveBeenCalledWith({ type: 'window', includeUncontrolled: true });
    expect(focus).toHaveBeenCalledOnce();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('opens a window when no client matches the URL', async () => {
    const { scope, openWindow } = createScope();
    const event = waitUntilEvent();

    handleNotificationClick(scope, {
      notification: { data: { url: '/settings' }, close: vi.fn() },
      waitUntil: event.waitUntil,
    });
    await event.flush();

    expect(openWindow).toHaveBeenCalledOnce();
    expect(openWindow).toHaveBeenCalledWith(`${ORIGIN}/settings`);
  });

  it('opens the dashboard root when the payload URL was null', async () => {
    const { scope, openWindow } = createScope();
    const event = waitUntilEvent();

    handleNotificationClick(scope, {
      notification: { data: { url: null }, close: vi.fn() },
      waitUntil: event.waitUntil,
    });
    await event.flush();

    expect(openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
  });
});

describe('registerPushHandlers', () => {
  it('wires push and notificationclick onto the worker global', async () => {
    const listeners = new Map<string, (event: never) => void>();
    const { scope, showNotification } = createScope();
    const addEventListener = vi.fn((type: string, listener: (event: never) => void) => {
      listeners.set(type, listener);
    });

    registerPushHandlers({
      ...scope,
      addEventListener: addEventListener as never,
    });

    expect(listeners.has('push')).toBe(true);
    expect(listeners.has('notificationclick')).toBe(true);

    const event = waitUntilEvent();
    listeners.get('push')!({
      data: { json: () => validPayload({ url: null }) },
      waitUntil: event.waitUntil,
    } as never);
    await event.flush();

    expect(showNotification).toHaveBeenCalledWith('Maintenance', {
      body: 'API restart in 5 minutes',
      icon: PUSH_NOTIFICATION_ICON,
      data: { url: null },
    });
  });
});
