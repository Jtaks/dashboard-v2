import type { Alert, Severity } from '@dashboard/shared';

/** Editable alert fields as held in the compose/edit form. */
export type AlertFormState = {
  severity: Severity;
  title: string;
  /** Empty string means no body; mapped to null on the wire. */
  body: string;
  topic: string;
  /** Empty string means no expiry; mapped to null on the wire. */
  endsAt: string;
};

/** POST /api/admin/alerts body. */
export type CreateAlertBody = {
  severity: Severity;
  title: string;
  body: string | null;
  topic: string;
  endsAt: string | null;
};

/** PATCH /api/admin/alerts/:id body — only changed fields. */
export type PatchAlertBody = {
  severity?: Severity;
  title?: string;
  body?: string | null;
  topic?: string;
  endsAt?: string | null;
};

/** Empty body field is sent as null, never as "". */
export function normalizeBody(body: string): string | null {
  return body.trim() === '' ? null : body;
}

/** Empty endsAt field is sent as null, never as "". */
export function normalizeEndsAt(endsAt: string): string | null {
  return endsAt.trim() === '' ? null : endsAt;
}

export function emptyAlertForm(topic = ''): AlertFormState {
  return {
    severity: 'info',
    title: '',
    body: '',
    topic,
    endsAt: '',
  };
}

export function alertToFormState(alert: Alert): AlertFormState {
  return {
    severity: alert.severity,
    title: alert.title,
    body: alert.body ?? '',
    topic: alert.topic,
    endsAt: alert.endsAt ?? '',
  };
}

/** Map compose form state to a create request body. */
export function toCreateAlertBody(form: AlertFormState): CreateAlertBody {
  return {
    severity: form.severity,
    title: form.title,
    body: normalizeBody(form.body),
    topic: form.topic,
    endsAt: normalizeEndsAt(form.endsAt),
  };
}

/**
 * Map edit form state to a PATCH body.
 * Untouched fields (equal to the baseline after normalization) are omitted.
 */
export function toPatchAlertBody(form: AlertFormState, baseline: AlertFormState): PatchAlertBody {
  const patch: PatchAlertBody = {};

  if (form.severity !== baseline.severity) {
    patch.severity = form.severity;
  }
  if (form.title !== baseline.title) {
    patch.title = form.title;
  }

  const nextBody = normalizeBody(form.body);
  const baseBody = normalizeBody(baseline.body);
  if (nextBody !== baseBody) {
    patch.body = nextBody;
  }

  if (form.topic !== baseline.topic) {
    patch.topic = form.topic;
  }

  const nextEnds = normalizeEndsAt(form.endsAt);
  const baseEnds = normalizeEndsAt(baseline.endsAt);
  if (nextEnds !== baseEnds) {
    patch.endsAt = nextEnds;
  }

  return patch;
}
