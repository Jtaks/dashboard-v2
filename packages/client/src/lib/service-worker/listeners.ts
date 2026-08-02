import { handleNotificationClick, handlePush } from './push.js';

type PushWorkerScope = Pick<
  ServiceWorkerGlobalScope,
  'addEventListener' | 'registration' | 'clients' | 'location'
>;

export function installPushListeners(scope: PushWorkerScope): void {
  scope.addEventListener('push', (event) => {
    const pushEvent = event as PushEvent;

    pushEvent.waitUntil(handlePush(pushEvent.data, scope.registration));
  });

  scope.addEventListener('notificationclick', (event) => {
    const clickEvent = event as NotificationEvent;

    clickEvent.waitUntil(
      handleNotificationClick(clickEvent.notification, scope.clients, scope.location.origin),
    );
  });
}
