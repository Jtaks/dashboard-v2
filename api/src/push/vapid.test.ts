import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_VAPID_KEYS_PATH,
  ensureVapidOrExit,
  loadVapidKeys,
  loadVapidSubject,
  resetVapidForTests,
  resolveVapidKeysPath,
  VapidLoadError,
} from './vapid.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

function fixture(name: string): string {
  return join(fixturesDir, name);
}

afterEach(() => {
  resetVapidForTests();
  vi.restoreAllMocks();
});

describe('resolveVapidKeysPath', () => {
  it('defaults to the TDD deployment path', () => {
    expect(resolveVapidKeysPath({})).toBe(DEFAULT_VAPID_KEYS_PATH);
  });

  it('reads VAPID_KEYS_PATH from the environment', () => {
    expect(resolveVapidKeysPath({ VAPID_KEYS_PATH: '/tmp/custom-vapid.json' })).toBe(
      '/tmp/custom-vapid.json',
    );
  });
});

describe('loadVapidKeys', () => {
  it('loads a valid keys file', () => {
    const keys = loadVapidKeys(fixture('vapid-valid.json'));
    expect(keys.publicKey).toMatch(/^BB/);
    expect(keys.privateKey.length).toBeGreaterThan(0);
  });

  it('rejects a file missing privateKey', () => {
    expect(() => loadVapidKeys(fixture('vapid-missing-private.json'))).toThrow(VapidLoadError);

    try {
      loadVapidKeys(fixture('vapid-missing-private.json'));
    } catch (err) {
      expect(err).toBeInstanceOf(VapidLoadError);
      const issues = (err as VapidLoadError).issues;
      expect(issues.some((i) => i.path.includes('privateKey'))).toBe(true);
    }
  });

  it('rejects a file that is not JSON', () => {
    expect(() => loadVapidKeys(fixture('vapid-not-json.json'))).toThrow(VapidLoadError);

    try {
      loadVapidKeys(fixture('vapid-not-json.json'));
    } catch (err) {
      expect(err).toBeInstanceOf(VapidLoadError);
      const issues = (err as VapidLoadError).issues;
      expect(issues[0]?.path).toBe('VAPID_KEYS_PATH');
      expect(issues[0]?.message).toMatch(/unparseable JSON/i);
    }
  });

  it('rejects an absent path', () => {
    expect(() => loadVapidKeys(fixture('vapid-does-not-exist.json'))).toThrow(VapidLoadError);

    try {
      loadVapidKeys(fixture('vapid-does-not-exist.json'));
    } catch (err) {
      expect(err).toBeInstanceOf(VapidLoadError);
      const issues = (err as VapidLoadError).issues;
      expect(issues[0]?.path).toBe('VAPID_KEYS_PATH');
      expect(issues[0]?.message).toMatch(/cannot read keys file/i);
    }
  });
});

describe('loadVapidSubject', () => {
  it('requires VAPID_SUBJECT', () => {
    expect(() => loadVapidSubject({})).toThrow(VapidLoadError);
    try {
      loadVapidSubject({});
    } catch (err) {
      expect((err as VapidLoadError).issues[0]?.path).toBe('VAPID_SUBJECT');
    }
  });

  it('returns a trimmed subject', () => {
    expect(loadVapidSubject({ VAPID_SUBJECT: ' mailto:ops@example.com ' })).toBe(
      'mailto:ops@example.com',
    );
  });
});

describe('ensureVapidOrExit', () => {
  it('exits non-zero and logs the faulty field when keys are missing', () => {
    const error = vi.fn();
    const exit = vi.fn(() => {
      throw new Error('exit');
    }) as unknown as (code: number) => never;

    expect(() =>
      ensureVapidOrExit(
        fixture('vapid-does-not-exist.json'),
        { VAPID_SUBJECT: 'mailto:ops@example.com' },
        { error },
        exit,
      ),
    ).toThrow('exit');

    expect(exit).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalled();
    const logged = String(error.mock.calls[0]?.[0]);
    expect(logged).toMatch(/^vapid: VAPID_KEYS_PATH:/);
    expect(logged).not.toMatch(/FBZCMHhGC9TyAgo48VhRHuYrJspA5qGscPALP6l1qSA/);
  });

  it('exits non-zero when privateKey is missing', () => {
    const error = vi.fn();
    const exit = vi.fn(() => {
      throw new Error('exit');
    }) as unknown as (code: number) => never;

    expect(() =>
      ensureVapidOrExit(
        fixture('vapid-missing-private.json'),
        { VAPID_SUBJECT: 'mailto:ops@example.com' },
        { error },
        exit,
      ),
    ).toThrow('exit');

    expect(exit).toHaveBeenCalledWith(1);
    const logged = String(error.mock.calls[0]?.[0]);
    expect(logged).toMatch(/privateKey/);
  });

  it('exits non-zero when VAPID_SUBJECT is absent', () => {
    const error = vi.fn();
    const exit = vi.fn(() => {
      throw new Error('exit');
    }) as unknown as (code: number) => never;

    expect(() => ensureVapidOrExit(fixture('vapid-valid.json'), {}, { error }, exit)).toThrow(
      'exit',
    );

    expect(exit).toHaveBeenCalledWith(1);
    expect(String(error.mock.calls[0]?.[0])).toMatch(/^vapid: VAPID_SUBJECT:/);
  });
});
