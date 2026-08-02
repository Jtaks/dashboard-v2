import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadVapidKeysFromFile,
  loadVapidKeysFromString,
  loadVapidKeysOrExit,
  VapidLoadError,
} from './load-vapid-keys.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function fixturePath(name: string): string {
  return join(fixturesDir, name);
}

function readFixture(name: string): string {
  return readFileSync(fixturePath(name), 'utf8');
}

afterEach(() => {
  delete process.env.VAPID_KEYS_PATH;
  vi.restoreAllMocks();
});

describe('loadVapidKeysFromFile', () => {
  it('loads a valid keys file', () => {
    const keys = loadVapidKeysFromFile(fixturePath('valid.json'));

    expect(keys.publicKey).toBe(
      'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
    );
    expect(keys.privateKey).toBe('UUxI4O8-FbRqjAkxvyJdrM5EHyCu7x96v0MOASq6Jgk');
  });

  it('fails when privateKey is missing', () => {
    expect(() => loadVapidKeysFromFile(fixturePath('missing-private-key.json'))).toThrow(
      VapidLoadError,
    );

    try {
      loadVapidKeysFromFile(fixturePath('missing-private-key.json'));
    } catch (error) {
      expect(error).toBeInstanceOf(VapidLoadError);
      const vapidError = error as VapidLoadError;
      expect(vapidError.issues.some((issue) => issue.path.includes('privateKey'))).toBe(true);
    }
  });

  it('fails on invalid JSON', () => {
    expect(() => loadVapidKeysFromFile(fixturePath('invalid.json'))).toThrow(VapidLoadError);

    try {
      loadVapidKeysFromFile(fixturePath('invalid.json'));
    } catch (error) {
      expect(error).toBeInstanceOf(VapidLoadError);
      const vapidError = error as VapidLoadError;
      expect(vapidError.issues[0]?.message).toMatch(/invalid json/i);
    }
  });

  it('fails when the keys file is missing', () => {
    expect(() => loadVapidKeysFromFile(fixturePath('does-not-exist.json'))).toThrow(VapidLoadError);
  });
});

describe('loadVapidKeysFromString', () => {
  it('parses valid JSON from a string', () => {
    const keys = loadVapidKeysFromString(readFixture('valid.json'));
    expect(keys.publicKey).toContain('BEl62iUY');
  });
});

describe('loadVapidKeysOrExit', () => {
  it('exits non-zero instead of returning a partial object', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as typeof process.exit);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => loadVapidKeysOrExit(fixturePath('missing-private-key.json'))).toThrow(
      'process.exit',
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(errorLog).toHaveBeenCalled();
  });
});
