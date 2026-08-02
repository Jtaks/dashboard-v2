/**
 * Pure dismissal helpers — no browser APIs.
 * Used by storage sync and unit-tested without a DOM.
 */

/**
 * Parse `dashboard.alerts.dismissed` JSON.
 * Missing, malformed, or non-array values yield `[]` and never throw.
 */
export function parseDismissedIds(raw: string | null | undefined): string[] {
  if (raw == null || raw === '') {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

/**
 * Keep only dismissed ids that still appear in the live alert list.
 * Ids no longer returned (or never returned) are dropped so storage stays bounded.
 */
export function pruneDismissedIds(
  storedIds: readonly string[],
  liveAlertIds: readonly string[],
): string[] {
  const live = new Set(liveAlertIds);
  return storedIds.filter((id) => live.has(id));
}
