import { describe, expect, it } from 'vitest';

import { expandAudience, type AudienceFixture } from './audience.js';
import { pushSendBodySchema } from './send-validation.js';

const groups = ['media-users', 'media-admins', 'docs-users'] as const;

/** Fixture vocabulary: dual-topic endpoint + singles + an unused group. */
const subscriptions: AudienceFixture[] = [
  { endpoint: 'https://push.example/a', topics: ['media-users', 'media-admins'] },
  { endpoint: 'https://push.example/b', topics: ['media-users'] },
  { endpoint: 'https://push.example/c', topics: ['docs-users'] },
];

describe('expandAudience', () => {
  it('expands * to every distinct endpoint once', () => {
    expect(expandAudience(subscriptions, '*')).toEqual([
      'https://push.example/a',
      'https://push.example/b',
      'https://push.example/c',
    ]);
  });

  it('selects only endpoints carrying a group topic', () => {
    expect(expandAudience(subscriptions, 'media-users')).toEqual([
      'https://push.example/a',
      'https://push.example/b',
    ]);
    expect(expandAudience(subscriptions, 'docs-users')).toEqual(['https://push.example/c']);
  });

  it('counts a dual-topic endpoint once when targeting one of its topics', () => {
    expect(expandAudience(subscriptions, 'media-admins')).toEqual(['https://push.example/a']);
  });

  it('returns an empty list for a topic no subscription carries', () => {
    expect(expandAudience(subscriptions, 'system-admins')).toEqual([]);
    expect(expandAudience([], 'media-users')).toEqual([]);
  });
});

describe('pushSendBodySchema', () => {
  const schema = pushSendBodySchema(groups);

  it('accepts a valid PushSend body', () => {
    expect(
      schema.safeParse({
        title: 'Hello',
        body: 'World',
        url: null,
        topic: '*',
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        title: 'Hello',
        body: 'World',
        url: '/apps/media',
        topic: 'media-users',
      }).success,
    ).toBe(true);
  });

  it('rejects missing title or body and unknown topics', () => {
    expect(schema.safeParse({ title: '', body: 'x', url: null, topic: '*' }).success).toBe(false);
    expect(schema.safeParse({ title: 'x', body: '', url: null, topic: '*' }).success).toBe(false);
    expect(
      schema.safeParse({ title: 'x', body: 'y', url: null, topic: 'ghost' }).success,
    ).toBe(false);
    expect(schema.safeParse({ title: 'x', body: 'y', topic: '*' }).success).toBe(false);
  });
});
