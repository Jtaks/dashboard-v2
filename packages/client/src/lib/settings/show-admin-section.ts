import type { Session } from '@dashboard/shared';

export function shouldShowAdminSection(session: Session | null | undefined): boolean {
  return session?.admin === true;
}
