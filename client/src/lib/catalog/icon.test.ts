import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_ICON_SRC, iconSrcOnError, resolveIconSrc } from './icon.js';

describe('resolveIconSrc', () => {
  it('resolves a config icon value against /icons/', () => {
    expect(resolveIconSrc('media.svg')).toBe('/icons/media.svg');
  });

  it('falls back to the placeholder when the icon value is empty', () => {
    expect(resolveIconSrc('')).toBe(PLACEHOLDER_ICON_SRC);
    expect(resolveIconSrc('   ')).toBe(PLACEHOLDER_ICON_SRC);
  });

  it('falls back to the placeholder for path-like or remote values', () => {
    expect(resolveIconSrc('../other.svg')).toBe(PLACEHOLDER_ICON_SRC);
    expect(resolveIconSrc('https://evil.example/icon.svg')).toBe(PLACEHOLDER_ICON_SRC);
  });
});

describe('iconSrcOnError', () => {
  it('returns the placeholder when an icon asset fails to load', () => {
    expect(iconSrcOnError('/icons/missing.svg')).toBe(PLACEHOLDER_ICON_SRC);
  });

  it('stays on the placeholder when that asset itself is missing', () => {
    expect(iconSrcOnError(PLACEHOLDER_ICON_SRC)).toBe(PLACEHOLDER_ICON_SRC);
    expect(iconSrcOnError('http://127.0.0.1:4173/icons/placeholder.svg')).toBe(
      PLACEHOLDER_ICON_SRC,
    );
  });
});
