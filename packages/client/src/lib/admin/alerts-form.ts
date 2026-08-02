import type { Alert, Severity } from '@dashboard/shared';

import type { CreateAlertBody, PatchAlertBody } from '$lib/api/admin.js';

import { datetimeLocalToIso, isoToDatetimeLocal } from './datetime.js';

export const SEVERITIES = ['info', 'success', 'warning', 'error'] as const satisfies readonly Severity[];

export type AlertFormState = {
  severity: Severity;
  title: string;
  body: string;
  topic: string;
  endsAt: string;
};

export function defaultFormState(topic = ''): AlertFormState {
  return {
    severity: 'info',
    title: '',
    body: '',
    topic,
    endsAt: '',
  };
}

export function formStateFromAlert(alert: Alert): AlertFormState {
  return {
    severity: alert.severity,
    title: alert.title,
    body: alert.body ?? '',
    topic: alert.topic,
    endsAt: isoToDatetimeLocal(alert.endsAt),
  };
}

function normalizeBody(body: string): string | null {
  return body.trim() === '' ? null : body;
}

function normalizeEndsAt(endsAt: string): string | null {
  return datetimeLocalToIso(endsAt);
}

export function toCreateBody(form: AlertFormState): CreateAlertBody {
  return {
    severity: form.severity,
    title: form.title,
    body: normalizeBody(form.body),
    topic: form.topic,
    endsAt: normalizeEndsAt(form.endsAt),
  };
}

export function toPatchBody(original: Alert, form: AlertFormState): PatchAlertBody {
  const patch: PatchAlertBody = {};
  const body = normalizeBody(form.body);
  const endsAt = normalizeEndsAt(form.endsAt);

  if (form.severity !== original.severity) {
    patch.severity = form.severity;
  }
  if (form.title !== original.title) {
    patch.title = form.title;
  }
  if (body !== original.body) {
    patch.body = body;
  }
  if (form.topic !== original.topic) {
    patch.topic = form.topic;
  }
  if (endsAt !== original.endsAt) {
    patch.endsAt = endsAt;
  }

  return patch;
}
