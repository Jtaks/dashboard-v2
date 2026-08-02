/** Response shapes from the TDD API surface. Shared contract between client and API. */

export type Status = 'up' | 'starting' | 'degraded' | 'down' | 'unknown';
export type Severity = 'info' | 'success' | 'warning' | 'error';

export type Session = { name: string; email: string; admin: boolean; logoutUrl: string };

export type Service = { id: string; name: string; hasContainers: boolean };
export type Application = {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: string;
  requestable: boolean;
  services: Service[];
};
export type Catalog = { applications: Application[] };

export type ServiceStatus = { id: string; status: Status | null; since: string | null };
export type ApplicationStatus = {
  id: string;
  status: Status | null;
  since: string | null;
  services: ServiceStatus[];
};
export type StatusReport = { collectedAt: string; applications: ApplicationStatus[] };

export type Alert = {
  id: string;
  severity: Severity;
  title: string;
  body: string | null;
  topic: string;
  endsAt: string | null;
  createdAt: string;
};

export type PushSend = { title: string; body: string; url: string | null; topic: string };
export type PushResult = { attempted: number; failed: number };
