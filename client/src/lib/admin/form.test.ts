import { describe, expect, it } from 'vitest';
import {
  alertToFormState,
  emptyAlertForm,
  toCreateAlertBody,
  toPatchAlertBody,
  type AlertFormState,
} from './form.js';

const baseline: AlertFormState = {
  severity: 'info',
  title: 'Maintenance',
  body: 'Tonight',
  topic: 'media-users',
  endsAt: '2026-12-01T00:00:00.000Z',
};

describe('toCreateAlertBody', () => {
  it('maps form state to a create body', () => {
    expect(
      toCreateAlertBody({
        severity: 'warning',
        title: 'Outage',
        body: 'Details',
        topic: '*',
        endsAt: '2026-08-02T12:00:00.000Z',
      }),
    ).toEqual({
      severity: 'warning',
      title: 'Outage',
      body: 'Details',
      topic: '*',
      endsAt: '2026-08-02T12:00:00.000Z',
    });
  });

  it('sends an empty body field as null', () => {
    expect(toCreateAlertBody({ ...emptyAlertForm('*'), title: 'T', body: '' }).body).toBeNull();
    expect(toCreateAlertBody({ ...emptyAlertForm('*'), title: 'T', body: '   ' }).body).toBeNull();
  });

  it('sends an empty endsAt field as null', () => {
    expect(toCreateAlertBody({ ...emptyAlertForm('*'), title: 'T', endsAt: '' }).endsAt).toBeNull();
  });
});

describe('toPatchAlertBody', () => {
  it('omits untouched fields from the PATCH payload', () => {
    expect(toPatchAlertBody(baseline, baseline)).toEqual({});
  });

  it('includes only changed fields', () => {
    expect(
      toPatchAlertBody({ ...baseline, title: 'Updated', severity: 'error' }, baseline),
    ).toEqual({
      title: 'Updated',
      severity: 'error',
    });
  });

  it('sends an emptied body field as null', () => {
    expect(toPatchAlertBody({ ...baseline, body: '' }, baseline)).toEqual({ body: null });
  });

  it('does not treat equivalent empty/null body as a change', () => {
    const noBody = { ...baseline, body: '' };
    expect(toPatchAlertBody(noBody, noBody)).toEqual({});
    expect(toPatchAlertBody({ ...noBody, body: '   ' }, noBody)).toEqual({});
  });

  it('includes endsAt when cleared', () => {
    expect(toPatchAlertBody({ ...baseline, endsAt: '' }, baseline)).toEqual({ endsAt: null });
  });
});

describe('alertToFormState', () => {
  it('maps a null body and endsAt to empty strings for the form', () => {
    expect(
      alertToFormState({
        id: 'a1',
        severity: 'success',
        title: 'All good',
        body: null,
        topic: '*',
        endsAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual({
      severity: 'success',
      title: 'All good',
      body: '',
      topic: '*',
      endsAt: '',
    });
  });
});
