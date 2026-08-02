/** Authenticated identity from Authelia forward_auth headers. */
export type Identity = {
  user: string;
  groups: string[];
  email: string;
  name: string;
};

export function isAdmin(groups: readonly string[], adminGroup: string): boolean {
  return groups.includes(adminGroup);
}

/** Split Authelia's comma-separated Remote-Groups into a trimmed list. */
export function parseGroupsHeader(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Build identity from Remote-* headers, or null when any required header is
 * absent/blank (fail closed). Empty Remote-Groups after split is also refused.
 */
export function identityFromHeaders(headers: {
  user: string | undefined;
  groups: string | undefined;
  email: string | undefined;
  name: string | undefined;
}): Identity | null {
  const user = headers.user?.trim();
  const groupsHeader = headers.groups?.trim();
  const email = headers.email?.trim();
  const name = headers.name?.trim();

  if (!user || groupsHeader === undefined || groupsHeader === '' || !email || !name) {
    return null;
  }

  // groupsHeader is non-empty string; still reject if it yields no group tokens
  // (e.g. "," or "  ,  ") — same fail-closed rule as an absent list.
  const groups = parseGroupsHeader(groupsHeader);
  if (groups.length === 0) {
    return null;
  }

  return { user, groups, email, name };
}
