import { afterEach, describe, expect, it, vi } from 'vitest';
import { m } from '$lib/paraglide/messages.js';
import { PUSH_FALLBACK_BODY, PUSH_FALLBACK_TITLE } from './fallback.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('push fallback constants', () => {
  it('mirrors the Paraglide catalog (SW cannot import Paraglide runtime)', () => {
    expect(PUSH_FALLBACK_TITLE).toBe(m.push_fallback_title());
    expect(PUSH_FALLBACK_BODY).toBe(m.push_fallback_body());
  });
});
