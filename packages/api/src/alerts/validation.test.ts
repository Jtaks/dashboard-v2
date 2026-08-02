import { describe, expect, it } from 'vitest';

import { SEVERITIES, createAlertBodySchema, createAlertPatchSchema } from './validation.js';

const VOCABULARY = ['media-users', 'media-admins'] as const;

describe('alert validation', () => {
  const bodySchema = createAlertBodySchema(VOCABULARY);
  const patchSchema = createAlertPatchSchema(VOCABULARY);

  const validBody = {
    severity: 'info' as const,
    title: 'Maintenance tonight',
    body: 'Expect brief downtime.',
    topic: 'media-users',
    endsAt: '2026-12-31T23:59:59.000Z',
  };

  it.each(SEVERITIES)('accepts severity %s', (severity) => {
    expect(bodySchema.safeParse({ ...validBody, severity }).success).toBe(true);
  });

  it('rejects an unknown severity', () => {
    expect(bodySchema.safeParse({ ...validBody, severity: 'critical' }).success).toBe(false);
  });

  it('accepts topic *', () => {
    expect(bodySchema.safeParse({ ...validBody, topic: '*' }).success).toBe(true);
  });

  it('accepts a configured group topic', () => {
    expect(bodySchema.safeParse({ ...validBody, topic: 'media-admins' }).success).toBe(true);
  });

  it('rejects a topic outside the vocabulary', () => {
    expect(bodySchema.safeParse({ ...validBody, topic: 'other-users' }).success).toBe(false);
  });

  it('rejects an empty title', () => {
    expect(bodySchema.safeParse({ ...validBody, title: '' }).success).toBe(false);
  });

  it('accepts null body and endsAt', () => {
    expect(
      bodySchema.safeParse({ ...validBody, body: null, endsAt: null }).success,
    ).toBe(true);
  });

  it('applies the same topic rules to partial updates', () => {
    expect(patchSchema.safeParse({ topic: '*' }).success).toBe(true);
    expect(patchSchema.safeParse({ topic: 'media-users' }).success).toBe(true);
    expect(patchSchema.safeParse({ topic: 'other-users' }).success).toBe(false);
  });

  it('applies the same severity rules to partial updates', () => {
    expect(patchSchema.safeParse({ severity: 'warning' }).success).toBe(true);
    expect(patchSchema.safeParse({ severity: 'critical' }).success).toBe(false);
  });
});
