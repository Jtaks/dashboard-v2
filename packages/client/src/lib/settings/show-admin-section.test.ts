import type { Session } from '@dashboard/shared';
import { describe, expect, it } from 'vitest';

import { shouldShowAdminSection } from './show-admin-section.js';

const session: Session = {
  name: 'Test User',
  email: 'test@example.com',
  admin: false,
  logoutUrl: 'https://auth.example/logout',
};

describe('shouldShowAdminSection', () => {
  it('is absent when session.admin is false', () => {
    expect(shouldShowAdminSection({ ...session, admin: false })).toBe(false);
  });

  it('is present when session.admin is true', () => {
    expect(shouldShowAdminSection({ ...session, admin: true })).toBe(true);
  });

  it('is absent when session is missing', () => {
    expect(shouldShowAdminSection(undefined)).toBe(false);
    expect(shouldShowAdminSection(null)).toBe(false);
  });

  it('derives visibility from the session response alone', () => {
    const nonAdminSession = { ...session, admin: false as const };
    const adminSession = { ...session, admin: true as const };

    expect(shouldShowAdminSection(nonAdminSession)).toBe(false);
    expect(shouldShowAdminSection(adminSession)).toBe(true);
    expect(shouldShowAdminSection({ ...nonAdminSession, admin: true })).toBe(true);
    expect(shouldShowAdminSection({ ...adminSession, admin: false })).toBe(false);
  });
});
