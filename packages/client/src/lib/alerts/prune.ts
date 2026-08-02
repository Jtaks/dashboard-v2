export function pruneDismissedIds(stored: string[], activeIds: string[]): string[] {
  const activeSet = new Set(activeIds);
  return stored.filter((id) => activeSet.has(id));
}
