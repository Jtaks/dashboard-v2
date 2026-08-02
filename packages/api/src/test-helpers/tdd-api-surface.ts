export type TddApiRoute = {
  method: string;
  path: string;
  admin: boolean;
};

/** Admin column from TDD API surface; parameterized segments use :id. */
export const TDD_API_SURFACE: TddApiRoute[] = [
  { method: 'GET', path: '/api/session', admin: false },
  { method: 'GET', path: '/api/catalog', admin: false },
  { method: 'GET', path: '/api/status', admin: false },
  { method: 'GET', path: '/api/alerts', admin: false },
  { method: 'GET', path: '/api/push/key', admin: false },
  { method: 'POST', path: '/api/push/subscriptions', admin: false },
  { method: 'DELETE', path: '/api/push/subscriptions', admin: false },
  { method: 'GET', path: '/api/admin/topics', admin: true },
  { method: 'GET', path: '/api/admin/alerts', admin: true },
  { method: 'POST', path: '/api/admin/alerts', admin: true },
  { method: 'PATCH', path: '/api/admin/alerts/:id', admin: true },
  { method: 'DELETE', path: '/api/admin/alerts/:id', admin: true },
  { method: 'POST', path: '/api/admin/push', admin: true },
];

export const STATE_CHANGING_METHODS = new Set(['POST', 'PATCH', 'DELETE']);
