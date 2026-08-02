/**
 * SW-safe fallback copy and icon for malformed push payloads (F3).
 *
 * Paraglide's generated runtime inspects `window` and can touch `localStorage`
 * under other strategies. The service worker must never use `localStorage`
 * (TDD — Client state), so the worker imports these constants instead of
 * `$lib/paraglide`. Keep the string values identical to `messages/en.json`
 * keys `push_fallback_title` / `push_fallback_body`; `fallback.test.ts`
 * asserts that sync after compile.
 *
 * Icon path is a static asset already in the A6 shell cache (`files`).
 */
export const PUSH_FALLBACK_TITLE = 'Notification';
export const PUSH_FALLBACK_BODY = 'A notification could not be displayed.';

/** Notification icon from the client static bundle. */
export const PUSH_NOTIFICATION_ICON = '/icons/placeholder.svg';
