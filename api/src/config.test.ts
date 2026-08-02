import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ConfigLoadError,
  getConfig,
  loadConfig,
  loadConfigOrExit,
  resetConfigForTests,
  resolveConfigPath,
  DEFAULT_CONFIG_PATH,
} from './config.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function fixture(name: string): string {
  return join(fixturesDir, name);
}

afterEach(() => {
  resetConfigForTests();
  vi.restoreAllMocks();
});

describe('resolveConfigPath', () => {
  it('defaults to the TDD deployment path', () => {
    expect(resolveConfigPath({})).toBe(DEFAULT_CONFIG_PATH);
  });

  it('reads CONFIG_PATH from the environment', () => {
    expect(resolveConfigPath({ CONFIG_PATH: '/tmp/custom.yaml' })).toBe('/tmp/custom.yaml');
  });
});

describe('loadConfig', () => {
  it('loads a valid file and applies adminGroup / requestable / service group defaults', () => {
    const config = loadConfig(fixture('defaults.yaml'));

    expect(config.adminGroup).toBe('system-admins');
    expect(config.applications[0]?.requestable).toBe(false);
    expect(config.applications[0]?.services[0]?.groups).toEqual(['media-users']);
    expect(getConfig()).toBe(config);
  });

  it('keeps an explicit service groups override', () => {
    const config = loadConfig(fixture('valid.yaml'));
    expect(config.applications[0]?.services[0]?.groups).toEqual(['media-users']);
    expect(config.applications[0]?.services[1]?.groups).toEqual(['media-admins']);
  });

  it('warns about unrecognized keys and still starts successfully', () => {
    const warn = vi.fn();
    const config = loadConfig(fixture('unrecognised-key.yaml'), {
      warn,
      error: vi.fn(),
    });

    expect(config.applications).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith('config: unrecognized key "futureFlag"');
    expect(warn).toHaveBeenCalledWith('config: unrecognized key "extraAppKey" at applications[0]');
    expect(warn).toHaveBeenCalledWith(
      'config: unrecognized key "mystery" at applications[0].services[0]',
    );
    expect(config).not.toHaveProperty('futureFlag');
  });

  it('rejects a dangling group and identifies the referencing application or service', () => {
    expect(() => loadConfig(fixture('dangling-group.yaml'))).toThrow(ConfigLoadError);

    try {
      loadConfig(fixture('dangling-group.yaml'));
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigLoadError);
      const issues = (err as ConfigLoadError).issues;
      expect(
        issues.some(
          (i) => i.message.includes('application "media"') && i.message.includes('ghost-users'),
        ),
      ).toBe(true);
      expect(
        issues.some(
          (i) =>
            i.message.includes('service "jellyfin"') &&
            i.message.includes('application "media"') &&
            i.message.includes('also-missing'),
        ),
      ).toBe(true);
    }

    expect(() => getConfig()).toThrow(/not been loaded/);
  });

  it('rejects a missing required url with a path to the offending key', () => {
    try {
      loadConfig(fixture('missing-required.yaml'));
      expect.unreachable('expected ConfigLoadError');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigLoadError);
      const issues = (err as ConfigLoadError).issues;
      expect(issues.some((i) => i.path === 'applications[0].url')).toBe(true);
    }
    expect(() => getConfig()).toThrow(/not been loaded/);
  });

  it('rejects unparseable YAML', () => {
    expect(() => loadConfig(fixture('invalid.yaml'))).toThrow(ConfigLoadError);
    try {
      loadConfig(fixture('invalid.yaml'));
    } catch (err) {
      expect((err as ConfigLoadError).issues[0]?.message).toMatch(/unparseable YAML/i);
    }
    expect(() => getConfig()).toThrow(/not been loaded/);
  });

  it('rejects a missing file', () => {
    expect(() => loadConfig(fixture('does-not-exist.yaml'))).toThrow(ConfigLoadError);
    expect(() => getConfig()).toThrow(/not been loaded/);
  });

  it('freezes the exposed value so mutations do not affect later readers', () => {
    const config = loadConfig(fixture('valid.yaml'));
    expect(() => {
      (config as { adminGroup: string }).adminGroup = 'hacked';
    }).toThrow();
    expect(() => {
      config.applications[0]?.groups.push('extra');
    }).toThrow();
    expect(getConfig().adminGroup).toBe('system-admins');
    expect(getConfig().applications[0]?.groups).toEqual(['media-users']);
  });

  it('does not re-read the file on later getConfig calls', () => {
    const path = fixture('valid.yaml');
    loadConfig(path);
    const first = getConfig();
    const second = getConfig();
    expect(second).toBe(first);
  });
});

describe('loadConfigOrExit', () => {
  it('exits non-zero on validation failure without leaving a partial config', () => {
    const error = vi.fn();
    const exit = vi.fn(() => {
      throw new Error('exit');
    }) as unknown as (code: number) => never;

    expect(() =>
      loadConfigOrExit(fixture('dangling-group.yaml'), { warn: vi.fn(), error }, exit),
    ).toThrow('exit');

    expect(exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls.length).toBeGreaterThan(0);
    expect(error.mock.calls.some((call) => String(call[0]).includes('ghost-users'))).toBe(true);
    expect(() => getConfig()).toThrow(/not been loaded/);
  });

  it('exits non-zero for missing required fields before any successful load', () => {
    const exit = vi.fn(() => {
      throw new Error('exit');
    }) as unknown as (code: number) => never;

    expect(() =>
      loadConfigOrExit(fixture('missing-required.yaml'), { warn: vi.fn(), error: vi.fn() }, exit),
    ).toThrow('exit');
    expect(exit).toHaveBeenCalledWith(1);
    expect(() => getConfig()).toThrow(/not been loaded/);
  });

  it('returns the loaded config on success', () => {
    const config = loadConfigOrExit(fixture('valid.yaml'), { warn: vi.fn(), error: vi.fn() });
    expect(config.applications[0]?.id).toBe('media');
    expect(getConfig()).toBe(config);
  });
});
