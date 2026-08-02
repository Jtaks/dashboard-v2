import { describe, expect, it } from 'vitest';

import { isInstalledPwa, isIosSafari, shouldShowIosPushNotice } from './ios.js';

const iosSafariUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const desktopChromeUserAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function createMatchMedia(matchesStandalone: boolean) {
  return (query: string): MediaQueryList =>
    ({
      matches: query === '(display-mode: standalone)' ? matchesStandalone : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

describe('isIosSafari', () => {
  it('detects iOS Safari user agents', () => {
    expect(isIosSafari(iosSafariUserAgent)).toBe(true);
  });

  it('does not treat desktop Chrome as iOS Safari', () => {
    expect(isIosSafari(desktopChromeUserAgent)).toBe(false);
  });

  it('does not treat iOS Chrome as iOS Safari', () => {
    expect(
      isIosSafari(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(false);
  });
});

describe('isInstalledPwa', () => {
  it('detects standalone display mode', () => {
    expect(isInstalledPwa(createMatchMedia(true), {} as Navigator)).toBe(true);
  });

  it('detects navigator.standalone on iOS', () => {
    expect(
      isInstalledPwa(createMatchMedia(false), { standalone: true } as Navigator & {
        standalone: boolean;
      }),
    ).toBe(true);
  });

  it('returns false in a normal browser tab', () => {
    expect(isInstalledPwa(createMatchMedia(false), {} as Navigator)).toBe(false);
  });
});

describe('shouldShowIosPushNotice', () => {
  it('shows the notice on iOS Safari outside an installed PWA', () => {
    expect(
      shouldShowIosPushNotice(iosSafariUserAgent, createMatchMedia(false), {} as Navigator),
    ).toBe(true);
  });

  it('hides the notice when the app is installed to the home screen', () => {
    expect(
      shouldShowIosPushNotice(iosSafariUserAgent, createMatchMedia(true), {} as Navigator),
    ).toBe(false);
  });

  it('hides the notice outside iOS Safari', () => {
    expect(
      shouldShowIosPushNotice(desktopChromeUserAgent, createMatchMedia(false), {} as Navigator),
    ).toBe(false);
  });
});
