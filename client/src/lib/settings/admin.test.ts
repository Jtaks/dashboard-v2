import { afterEach, describe, expect, it, vi } from 'vitest';
import { shouldShowAdminSection } from './admin.js';

describe('shouldShowAdminSection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is true only when the session response has admin true', () => {
    expect(shouldShowAdminSection({ admin: true })).toBe(true);
    expect(shouldShowAdminSection({ admin: false })).toBe(false);
  });

  it('ignores localStorage and other client-held values', () => {
    const map = new Map<string, string>([
      ['dashboard.flags', JSON.stringify({ 'some-admin-flag': true })],
      ['admin', 'true'],
      ['dashboard.admin', 'true'],
    ]);
    vi.stubGlobal('localStorage', {
      length: map.size,
      clear() {
        map.clear();
      },
      getItem(key: string) {
        return map.has(key) ? map.get(key)! : null;
      },
      key(index: number) {
        return [...map.keys()][index] ?? null;
      },
      removeItem(key: string) {
        map.delete(key);
      },
      setItem(key: string, value: string) {
        map.set(key, String(value));
      },
    } satisfies Storage);

    expect(shouldShowAdminSection({ admin: false })).toBe(false);
    expect(shouldShowAdminSection({ admin: true })).toBe(true);
  });
});
