export type TestUser = {
  user: string;
  groups: string[];
  email: string;
  name: string;
};

export function headersForUser(
  user: TestUser | null,
  options: {
    origin?: string;
    contentType?: string;
    extra?: Record<string, string>;
  } = {},
): HeadersInit {
  const base: Record<string, string> = {
    Accept: 'application/json',
    ...(options.contentType ? { 'Content-Type': options.contentType } : {}),
    ...(options.origin ? { Origin: options.origin } : {}),
    ...(options.extra ?? {}),
  };

  if (!user) {
    return base;
  }

  return {
    ...base,
    'Remote-User': user.user,
    'Remote-Groups': user.groups.join(','),
    'Remote-Email': user.email,
    'Remote-Name': user.name,
  };
}

export function headersWithIdentityOverrides(
  user: TestUser,
  overrides: {
    remoteUser?: string | null;
    remoteGroups?: string | null;
    origin?: string;
    contentType?: string;
    extra?: Record<string, string>;
  } = {},
): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(overrides.contentType ? { 'Content-Type': overrides.contentType } : {}),
    ...(overrides.origin ? { Origin: overrides.origin } : {}),
    ...(overrides.extra ?? {}),
  };

  if (overrides.remoteUser !== null) {
    headers['Remote-User'] = overrides.remoteUser ?? user.user;
  }

  if (overrides.remoteGroups !== null) {
    headers['Remote-Groups'] = overrides.remoteGroups ?? user.groups.join(',');
  }

  if (overrides.remoteUser !== null || overrides.remoteGroups !== null) {
    headers['Remote-Email'] = user.email;
    headers['Remote-Name'] = user.name;
  }

  return headers;
}
