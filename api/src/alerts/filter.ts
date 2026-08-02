import type { AlertRecord } from './repository.js';

/**
 * Whether an alert is live and targeted at the given Remote-Groups.
 *
 * Targeting: topic `*` matches everyone; otherwise the topic must appear in
 * `groups`. Membership of adminGroup is irrelevant here — callers pass the
 * user's own groups only.
 *
 * Expiry: a non-null `endsAt` strictly earlier than `now` is excluded; null
 * never expires.
 */
export function isAlertVisible(
  alert: Pick<AlertRecord, 'topic' | 'endsAt'>,
  groups: readonly string[],
  now: Date,
): boolean {
  if (alert.endsAt !== null) {
    const endsAtMs = Date.parse(alert.endsAt);
    if (Number.isNaN(endsAtMs) || endsAtMs < now.getTime()) {
      return false;
    }
  }

  if (alert.topic === '*') {
    return true;
  }

  return groups.includes(alert.topic);
}

/** Keep only alerts that are live and targeted at `groups`, preserving order. */
export function filterAlertsForUser(
  alerts: readonly AlertRecord[],
  groups: readonly string[],
  now: Date = new Date(),
): AlertRecord[] {
  return alerts.filter((alert) => isAlertVisible(alert, groups, now));
}
