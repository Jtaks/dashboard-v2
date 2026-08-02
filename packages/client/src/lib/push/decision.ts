export type NotificationPermissionState = 'default' | 'granted' | 'denied';

export type PushLoadAction = 'upsert' | 'prompt' | 'none';

export function resolvePushLoadAction(input: {
  pushSupported: boolean;
  hasSubscription: boolean;
  notificationPermission: NotificationPermissionState;
  promptDismissed: boolean;
}): PushLoadAction {
  if (!input.pushSupported) {
    return 'none';
  }

  if (input.hasSubscription) {
    return 'upsert';
  }

  if (input.notificationPermission === 'denied') {
    return 'none';
  }

  if (input.notificationPermission !== 'default') {
    return 'none';
  }

  if (input.promptDismissed) {
    return 'none';
  }

  return 'prompt';
}
