export function isIosSafari(userAgent: string = navigator.userAgent): boolean {
  const isIos =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (typeof navigator !== 'undefined' &&
      navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);

  return isIos && isSafari;
}

export function isInstalledPwa(
  matchMedia: (query: string) => MediaQueryList = window.matchMedia.bind(window),
  navigatorLike: Navigator = navigator,
): boolean {
  if (matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  return (navigatorLike as Navigator & { standalone?: boolean }).standalone === true;
}

export function shouldShowIosPushNotice(
  userAgent: string = navigator.userAgent,
  matchMedia: (query: string) => MediaQueryList = window.matchMedia.bind(window),
  navigatorLike: Navigator = navigator,
): boolean {
  return isIosSafari(userAgent) && !isInstalledPwa(matchMedia, navigatorLike);
}
