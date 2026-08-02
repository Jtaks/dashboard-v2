import { describe, expect, it } from 'vitest';
import { decidePushLoadAction, type PushLoadDecisionInput } from './decision.js';

function input(overrides: Partial<PushLoadDecisionInput> = {}): PushLoadDecisionInput {
  return {
    pushSupported: true,
    hasSubscription: false,
    promptDismissed: false,
    permission: 'default',
    ...overrides,
  };
}

describe('decidePushLoadAction', () => {
  it('returns upsert when a subscription is present regardless of prompt or permission', () => {
    expect(
      decidePushLoadAction(
        input({ hasSubscription: true, promptDismissed: false, permission: 'default' }),
      ),
    ).toBe('upsert');
    expect(
      decidePushLoadAction(
        input({ hasSubscription: true, promptDismissed: true, permission: 'default' }),
      ),
    ).toBe('upsert');
    expect(
      decidePushLoadAction(
        input({ hasSubscription: true, promptDismissed: false, permission: 'granted' }),
      ),
    ).toBe('upsert');
    expect(
      decidePushLoadAction(
        input({ hasSubscription: true, promptDismissed: true, permission: 'denied' }),
      ),
    ).toBe('upsert');
  });

  it('returns prompt only with no subscription, not dismissed, and permission default', () => {
    expect(decidePushLoadAction(input())).toBe('prompt');
  });

  it('returns none when the prompt was dismissed', () => {
    expect(decidePushLoadAction(input({ promptDismissed: true }))).toBe('none');
  });

  it('returns none when permission is denied', () => {
    expect(decidePushLoadAction(input({ permission: 'denied' }))).toBe('none');
    expect(decidePushLoadAction(input({ permission: 'denied', promptDismissed: false }))).toBe(
      'none',
    );
  });

  it('returns none when permission is granted but there is no subscription', () => {
    expect(decidePushLoadAction(input({ permission: 'granted' }))).toBe('none');
  });

  it('returns none when push is unsupported', () => {
    expect(
      decidePushLoadAction(
        input({
          pushSupported: false,
          hasSubscription: false,
          permission: 'default',
          promptDismissed: false,
        }),
      ),
    ).toBe('none');
    expect(
      decidePushLoadAction(
        input({
          pushSupported: false,
          hasSubscription: true,
          permission: 'granted',
        }),
      ),
    ).toBe('none');
  });

  it('covers the full permission × dismissed × subscription matrix for supported browsers', () => {
    const permissions = ['default', 'granted', 'denied'] as const;
    const dismissedFlags = [false, true];
    const subscriptionFlags = [false, true];

    const expected: Record<string, string> = {};
    for (const hasSubscription of subscriptionFlags) {
      for (const promptDismissed of dismissedFlags) {
        for (const permission of permissions) {
          const key = `${hasSubscription}:${promptDismissed}:${permission}`;
          expected[key] = decidePushLoadAction(
            input({ hasSubscription, promptDismissed, permission }),
          );
        }
      }
    }

    expect(expected).toEqual({
      'false:false:default': 'prompt',
      'false:false:granted': 'none',
      'false:false:denied': 'none',
      'false:true:default': 'none',
      'false:true:granted': 'none',
      'false:true:denied': 'none',
      'true:false:default': 'upsert',
      'true:false:granted': 'upsert',
      'true:false:denied': 'upsert',
      'true:true:default': 'upsert',
      'true:true:granted': 'upsert',
      'true:true:denied': 'upsert',
    });
  });
});
