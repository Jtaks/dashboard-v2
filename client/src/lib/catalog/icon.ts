/** Public URL for the committed placeholder when an icon asset is missing. */
export const PLACEHOLDER_ICON_SRC = '/icons/placeholder.svg';

/**
 * Resolve an application `icon` config value to a client-bundled `/icons/` path.
 * Empty or unsafe values fall back to the placeholder so the img never points at
 * an application-hosted or path-escaping URL.
 */
export function resolveIconSrc(icon: string): string {
  const trimmed = icon.trim();
  if (!trimmed) {
    return PLACEHOLDER_ICON_SRC;
  }

  // Bare filename only — never a path, URL, or traversal segment.
  if (
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.includes(':') ||
    trimmed === '.' ||
    trimmed === '..'
  ) {
    return PLACEHOLDER_ICON_SRC;
  }

  return `/icons/${trimmed}`;
}

/**
 * When an `<img>` fails to load (missing asset), swap to the placeholder.
 * Idempotent so a missing placeholder itself does not loop.
 */
export function iconSrcOnError(currentSrc: string): string {
  if (
    !currentSrc ||
    currentSrc.endsWith('/placeholder.svg') ||
    currentSrc === PLACEHOLDER_ICON_SRC
  ) {
    return PLACEHOLDER_ICON_SRC;
  }
  return PLACEHOLDER_ICON_SRC;
}
