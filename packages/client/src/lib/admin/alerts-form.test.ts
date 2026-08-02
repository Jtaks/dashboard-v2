import type { Alert } from '@dashboard/shared';
import { describe, expect, it } from 'vitest';

import {
  defaultFormState,
  formStateFromAlert,
  toCreateBody,
  toPatchBody,
} from './alerts-form.js';

const sampleAlert: Alert = {
  id: 'alert-1',
  severity: 'warning',
  title: 'Maintenance window',
  body: 'Services may be unavailable.',
  topic: 'media-users',
  endsAt: '2026-08-01T20:00:00.000Z',
  createdAt: '2026-07-01T12:00:00.000Z',
};

describe('toCreateBody', () => {
  it('maps form state to a create request body', () => {
    const form = {
      ...defaultFormState('*'),
      severity: 'error' as const,
      title: 'Outage',
      body: '  ',
      endsAt: '',
    };

    expect(toCreateBody(form)).toEqual({
      severity: 'error',
      title: 'Outage',
      body: null,
      topic: '*',
      endsAt: null,
    });
  });
});

describe('toPatchBody', () => {
  it('omits untouched fields from the patch payload', () => {
    const form = formStateFromAlert(sampleAlert);
    form.title = 'Updated title';

    expect(toPatchBody(sampleAlert, form)).toEqual({
      title: 'Updated title',
    });
  });

  it('sends an empty body field as null', () => {
    const form = formStateFromAlert(sampleAlert);
    form.body = '';

    expect(toPatchBody(sampleAlert, form)).toEqual({
      body: null,
    });
  });
});
