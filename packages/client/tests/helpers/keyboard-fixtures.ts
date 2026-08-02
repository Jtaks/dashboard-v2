import type { Alert, Application, Catalog, Session, StatusReport } from '@dashboard/shared';

export const keyboardSession: Session = {
  name: 'Test User',
  email: 'test@example.com',
  admin: false,
  logoutUrl: 'https://auth.example/logout',
};

export const keyboardAdminSession: Session = {
  ...keyboardSession,
  admin: true,
};

export const keyboardApplications: Application[] = [
  {
    id: 'app-one',
    name: 'App One',
    description: 'First application',
    url: 'https://app-one.example/',
    icon: 'app-one.svg',
    requestable: false,
    services: [],
  },
  {
    id: 'app-two',
    name: 'App Two',
    description: 'Second application',
    url: 'https://app-two.example/',
    icon: 'app-two.svg',
    requestable: false,
    services: [],
  },
];

export const keyboardMediaApplication: Application = {
  id: 'media',
  name: 'Media',
  description: 'Films and series.',
  url: 'https://media.example/',
  icon: 'media.svg',
  requestable: false,
  services: [
    { id: 'jellyfin', name: 'Jellyfin', hasContainers: true },
    { id: 'db', name: 'Database', hasContainers: true },
    { id: 'portal', name: 'Portal', hasContainers: false },
  ],
};

export const keyboardCatalog: Catalog = {
  applications: [...keyboardApplications, keyboardMediaApplication],
};

export const keyboardStatusReport: StatusReport = {
  collectedAt: '2026-01-04T12:00:00.000Z',
  applications: [
    {
      id: 'media',
      status: 'degraded',
      since: '2026-01-01T12:00:00.000Z',
      services: [
        { id: 'jellyfin', status: 'up', since: '2026-01-04T11:58:30.000Z' },
        { id: 'db', status: 'down', since: '2026-01-01T11:00:00.000Z' },
        { id: 'portal', status: null, since: null },
      ],
    },
  ],
};

export const keyboardWarningAlert: Alert = {
  id: 'alert-warning-1',
  severity: 'warning',
  title: 'Scheduled maintenance',
  body: 'Services may be unavailable tonight.',
  topic: '*',
  endsAt: null,
  createdAt: '2026-01-01T10:00:00.000Z',
};

export const keyboardExistingAlert: Alert = {
  id: 'alert-1',
  severity: 'warning',
  title: 'Scheduled maintenance',
  body: 'Expect brief downtime.',
  topic: 'media-users',
  endsAt: '2099-01-01T12:00:00.000Z',
  createdAt: '2026-01-01T12:00:00.000Z',
};
