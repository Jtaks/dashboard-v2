/**
 * Settings notification section: derive UI status from the live browser
 * subscription + permission (never localStorage), and iOS Safari PWA notice.
 */

export type SettingsPushUiStatus = 'subscribed' | 'not_subscribed' | 'blocked';

export type SettingsPushStatusInput = {
  /** True when `pushManager.getSubscription()` returned a subscription. */
  hasSubscription: boolean;
  permission: NotificationPermission | 'unsupported';
};

/**
 * Map subscription + permission to the three settings UI states.
 * `denied` wins even if a stale subscription object were still present.
 */
export function deriveSettingsPushStatus(input: SettingsPushStatusInput): SettingsPushUiStatus {
  if (input.permission === 'denied') {
    return 'blocked';
  }
  if (input.hasSubscription) {
    return 'subscribed';
  }
  return 'not_subscribed';
}

export type SettingsPushView = {
  status: SettingsPushUiStatus;
  showSubscribe: boolean;
  showUnsubscribe: boolean;
};

export type SettingsPushViewInput = SettingsPushStatusInput & {
  /** False when Service Worker / PushManager / Notification are unavailable. */
  supported: boolean;
};

/** Status plus which actions the settings section should offer. */
export function deriveSettingsPushView(input: SettingsPushViewInput): SettingsPushView {
  const status = deriveSettingsPushStatus(input);

  if (status === 'blocked' || !input.supported) {
    return {
      status,
      showSubscribe: false,
      showUnsubscribe: false,
    };
  }

  if (status === 'subscribed') {
    return {
      status,
      showSubscribe: false,
      showUnsubscribe: true,
    };
  }

  return {
    status,
    showSubscribe: true,
    showUnsubscribe: false,
  };
}

export type IosPwaNoticeInput = {
  userAgent: string;
  /** `navigator.maxTouchPoints` — used for iPadOS desktop-UA detection. */
  maxTouchPoints?: number;
  /** iOS Safari `navigator.standalone`. */
  navigatorStandalone?: boolean;
  /** `matchMedia('(display-mode: standalone)').matches`. */
  displayModeStandalone?: boolean;
};

/**
 * True for iOS Safari (including iPadOS spoofing a Macintosh UA).
 * Other iOS browsers (CriOS, FxiOS, …) return false.
 */
export function isIosSafari(userAgent: string, maxTouchPoints = 0): boolean {
  const isAppleMobile =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);

  if (!isAppleMobile) {
    return false;
  }

  // Chrome / Firefox / Edge on iOS identify themselves; Safari does not.
  if (/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent)) {
    return false;
  }

  return /Safari/i.test(userAgent) || /AppleWebKit/i.test(userAgent);
}

/** True when the page is running as an installed PWA (home screen / standalone). */
export function isInstalledPwa(input: {
  navigatorStandalone?: boolean;
  displayModeStandalone?: boolean;
}): boolean {
  return input.navigatorStandalone === true || input.displayModeStandalone === true;
}

/**
 * Show the home-screen install notice only on iOS Safari outside an installed PWA.
 */
export function shouldShowIosPwaNotice(input: IosPwaNoticeInput): boolean {
  if (!isIosSafari(input.userAgent, input.maxTouchPoints ?? 0)) {
    return false;
  }
  if (isInstalledPwa(input)) {
    return false;
  }
  return true;
}

/** Read display-mode / standalone from the current window (SSR-safe). */
export function readInstalledPwaFlags(): {
  navigatorStandalone: boolean;
  displayModeStandalone: boolean;
} {
  if (typeof window === 'undefined') {
    return { navigatorStandalone: false, displayModeStandalone: false };
  }

  const navigatorStandalone =
    'standalone' in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  let displayModeStandalone = false;
  try {
    displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    displayModeStandalone = false;
  }

  return { navigatorStandalone, displayModeStandalone };
}

/**
 * Whether the settings iOS home-screen notice should show in this browsing context.
 * Safe to call during SSR (returns false).
 */
export function readShouldShowIosPwaNotice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  return shouldShowIosPwaNotice({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    ...readInstalledPwaFlags(),
  });
}
