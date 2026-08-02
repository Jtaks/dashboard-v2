import type { Session } from '@dashboard/shared';

/**
 * Whether the settings admin section should render.
 * Derives solely from `GET /api/session`'s `admin` flag — never from localStorage
 * or any other client-held value (TDD Authentication and identity).
 */
export function shouldShowAdminSection(session: Pick<Session, 'admin'>): boolean {
  return session.admin === true;
}
