import type { Alert, PushResult } from '@dashboard/shared';

import { apiFetch, apiJson } from './client.js';

export type AdminTopics = {
  topics: string[];
};

export type CreateAlertBody = {
  severity: Alert['severity'];
  title: string;
  body: string | null;
  topic: string;
  endsAt: string | null;
};

export type PatchAlertBody = Partial<CreateAlertBody>;

export type SendPushBody = {
  title: string;
  body: string;
  url: string | null;
  topic: string;
};

export function fetchAdminTopics(): Promise<AdminTopics> {
  return apiJson<AdminTopics>('/api/admin/topics');
}

export function fetchAdminAlerts(): Promise<Alert[]> {
  return apiJson<Alert[]>('/api/admin/alerts');
}

export function createAdminAlert(body: CreateAlertBody): Promise<Alert> {
  return apiJson<Alert>('/api/admin/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchAdminAlert(id: string, body: PatchAlertBody): Promise<Alert> {
  return apiJson<Alert>(`/api/admin/alerts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteAdminAlert(id: string): Promise<void> {
  await apiFetch(`/api/admin/alerts/${id}`, { method: 'DELETE' });
}

export function sendAdminPush(body: SendPushBody): Promise<PushResult> {
  return apiJson<PushResult>('/api/admin/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
