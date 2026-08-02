import { describe, expect, it } from 'vitest';

import { createPushSendSchema } from './validation.js';

const VOCABULARY = ['media-users', 'media-admins'] as const;

describe('push send validation', () => {
  const schema = createPushSendSchema(VOCABULARY);

  it('accepts a valid push payload', () => {
    expect(
      schema.safeParse({
        title: 'Maintenance',
        body: 'Expect downtime.',
        url: 'https://dashboard.example.com',
        topic: 'media-users',
      }).success,
    ).toBe(true);
  });

  it('accepts a null url and wildcard topic', () => {
    expect(
      schema.safeParse({
        title: 'Alert',
        body: 'Everyone',
        url: null,
        topic: '*',
      }).success,
    ).toBe(true);
  });

  it('rejects empty title or body', () => {
    expect(
      schema.safeParse({
        title: '',
        body: 'Body',
        url: null,
        topic: '*',
      }).success,
    ).toBe(false);

    expect(
      schema.safeParse({
        title: 'Title',
        body: '',
        url: null,
        topic: '*',
      }).success,
    ).toBe(false);
  });

  it('rejects topics outside the configured vocabulary', () => {
    expect(
      schema.safeParse({
        title: 'Title',
        body: 'Body',
        url: null,
        topic: 'other-users',
      }).success,
    ).toBe(false);
  });
});
