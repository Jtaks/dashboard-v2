import { describe, expect, it } from 'vitest';

import { SEVERITIES, createAlertBodySchema, patchAlertBodySchema } from './validation.js';

const groups = ['media-users', 'media-admins'] as const;

describe('createAlertBodySchema', () => {
  const schema = createAlertBodySchema(groups);

  it.each(SEVERITIES)('accepts severity %s', (severity) => {
    const result = schema.safeParse({
      severity,
      title: 'Hello',
      body: null,
      endsAt: null,
      topic: 'media-users',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a severity outside the vocabulary', () => {
    const result = schema.safeParse({
      severity: 'critical',
      title: 'Hello',
      topic: 'media-users',
    });
    expect(result.success).toBe(false);
  });

  it('accepts topic *', () => {
    const result = schema.safeParse({
      severity: 'info',
      title: 'Broadcast',
      topic: '*',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a configured group as topic', () => {
    const result = schema.safeParse({
      severity: 'warning',
      title: 'Media',
      topic: 'media-admins',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a group absent from the vocabulary', () => {
    const result = schema.safeParse({
      severity: 'info',
      title: 'Nope',
      topic: 'unknown-group',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty title', () => {
    const result = schema.safeParse({
      severity: 'info',
      title: '',
      topic: '*',
    });
    expect(result.success).toBe(false);
  });

  it('strips id and created_by from the parsed body', () => {
    const result = schema.safeParse({
      id: 'forged-id',
      created_by: 'eve',
      createdBy: 'eve',
      severity: 'info',
      title: 'Ok',
      topic: '*',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        severity: 'info',
        title: 'Ok',
        topic: '*',
      });
      expect(result.data).not.toHaveProperty('id');
      expect(result.data).not.toHaveProperty('created_by');
      expect(result.data).not.toHaveProperty('createdBy');
    }
  });
});

describe('patchAlertBodySchema', () => {
  const schema = patchAlertBodySchema(groups);

  it('accepts a partial endsAt-only update', () => {
    const result = schema.safeParse({ endsAt: '2030-01-01T00:00:00.000Z' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ endsAt: '2030-01-01T00:00:00.000Z' });
    }
  });

  it('rejects an invalid severity on patch', () => {
    const result = schema.safeParse({ severity: 'lol' });
    expect(result.success).toBe(false);
  });

  it('rejects a topic absent from the vocabulary', () => {
    const result = schema.safeParse({ topic: 'not-a-group' });
    expect(result.success).toBe(false);
  });
});
