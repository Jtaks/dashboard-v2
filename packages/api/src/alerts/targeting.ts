export function isAlertExpired(endsAt: string | null, referenceTime: string): boolean {
  return endsAt !== null && endsAt < referenceTime;
}

export function isAlertTargeted(topic: string, groups: string[]): boolean {
  return topic === '*' || groups.includes(topic);
}

export function isVisibleAlert(
  alert: { topic: string; endsAt: string | null },
  groups: string[],
  referenceTime: string,
): boolean {
  return isAlertTargeted(alert.topic, groups) && !isAlertExpired(alert.endsAt, referenceTime);
}
