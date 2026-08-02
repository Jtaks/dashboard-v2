import type { PushSend } from '@dashboard/shared';

/** Narrow unknown JSON to the shared `PushSend` contract. */
export function isPushSend(value: unknown): value is PushSend {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.title === 'string' &&
    typeof record.body === 'string' &&
    (record.url === null || typeof record.url === 'string') &&
    typeof record.topic === 'string'
  );
}

/**
 * Parse push event data as `PushSend`. Returns null for missing data,
 * non-JSON, or a shape that does not match the contract — never throws.
 */
export function parsePushSend(data: { json(): unknown } | null): PushSend | null {
  if (!data) {
    return null;
  }
  try {
    const parsed = data.json();
    return isPushSend(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
