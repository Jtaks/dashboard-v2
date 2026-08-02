import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getConfig, initConfig, resetConfigForTesting } from './get-config.js';
import {
  ConfigLoadError,
  loadConfigFromFile,
  loadConfigFromString,
  loadConfigOrExit,
} from './load-config.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function fixturePath(name: string): string {
  return join(fixturesDir, name);
}

function readFixture(name: string): string {
  return readFileSync(fixturePath(name), 'utf8');
}

afterEach(() => {
  resetConfigForTesting();
  delete process.env.CONFIG_PATH;
  vi.restoreAllMocks();
});

describe('loadConfigFromFile', () => {
  it('loads a valid config and applies defaults', () => {
    const config = loadConfigFromFile(fixturePath('valid.yaml'));

    expect(config.adminGroup).toBe('system-admins');
    expect(config.applications[0]?.requestable).toBe(false);

    const inheritedService = config.applications[0]?.services[0];
    const explicitService = config.applications[0]?.services[1];

    expect(inheritedService?.groups).toEqual(['media-users']);
    expect(explicitService?.groups).toEqual(['media-admins']);
  });

  it('warns and ignores unrecognized keys', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config = loadConfigFromFile(fixturePath('unrecognized-key.yaml'));

    expect(config.applications).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(
      'Unrecognized config key "futureFeature" ignored',
    );
  });

  it('fails when a group reference is absent from the top-level list', () => {
    expect(() => loadConfigFromFile(fixturePath('dangling-group-reference.yaml'))).toThrow(
      ConfigLoadError,
    );

    try {
      loadConfigFromFile(fixturePath('dangling-group-reference.yaml'));
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigLoadError);
      const configError = error as ConfigLoadError;
      expect(configError.issues.some((issue) => issue.message.includes('application "app"'))).toBe(
        true,
      );
    }
  });

  it('fails when a required value is missing', () => {
    expect(() => loadConfigFromFile(fixturePath('missing-required-value.yaml'))).toThrow(
      ConfigLoadError,
    );

    try {
      loadConfigFromFile(fixturePath('missing-required-value.yaml'));
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigLoadError);
      const configError = error as ConfigLoadError;
      expect(
        configError.issues.some(
          (issue) => issue.path.includes('url') || issue.message.toLowerCase().includes('url'),
        ),
      ).toBe(true);
    }
  });

  it('fails on invalid YAML', () => {
    expect(() => loadConfigFromFile(fixturePath('invalid.yaml'))).toThrow(ConfigLoadError);

    try {
      loadConfigFromFile(fixturePath('invalid.yaml'));
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigLoadError);
      const configError = error as ConfigLoadError;
      expect(configError.issues[0]?.message).toMatch(/invalid yaml/i);
    }
  });

  it('fails when the config file is missing', () => {
    expect(() => loadConfigFromFile(fixturePath('does-not-exist.yaml'))).toThrow(ConfigLoadError);
  });

  it('collects every validation failure in one pass', () => {
    const yaml = `
groups: []
applications:
  - id: broken
    name: Broken
    description: Multiple dangling group references.
    url: https://broken.example.com
    icon: broken.svg
    groups: [ghost-group]
    services:
      - id: svc
        name: Service
        containers: []
        groups: [another-ghost]
`;

    try {
      loadConfigFromString(yaml);
      expect.unreachable('expected config load to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigLoadError);
      const configError = error as ConfigLoadError;
      expect(configError.issues).toHaveLength(2);
      expect(configError.issues.some((issue) => issue.message.includes('application "broken"'))).toBe(
        true,
      );
      expect(configError.issues.some((issue) => issue.message.includes('service "svc"'))).toBe(
        true,
      );
    }
  });
});

describe('loadConfigOrExit', () => {
  it('exits non-zero instead of returning a partial object', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as typeof process.exit);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => loadConfigOrExit(fixturePath('missing-required-value.yaml'))).toThrow(
      'process.exit',
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(errorLog).toHaveBeenCalled();
  });
});

describe('initConfig and getConfig', () => {
  it('exposes a frozen in-memory value through a single accessor', () => {
    const first = initConfig(fixturePath('valid.yaml'));
    const second = getConfig();

    expect(first).toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.applications)).toBe(true);
    expect(Object.isFrozen(first.applications[0]?.services)).toBe(true);

    expect(Object.isFrozen(first.applications[0])).toBe(true);

    expect(() => {
      const application = first.applications[0];
      if (application) {
        application.name = 'mutated';
      }
    }).toThrow(TypeError);

    expect(getConfig().applications[0]?.name).toBe('Media');
  });

  it('does not re-read the config file after initialization', () => {
    const first = initConfig(fixturePath('valid.yaml'));
    const second = initConfig(fixturePath('missing-required-value.yaml'));

    expect(second).toBe(first);
    expect(second.applications[0]?.id).toBe('media');
  });

  it('exits non-zero when initialization fails', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as typeof process.exit);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => initConfig(fixturePath('invalid.yaml'))).toThrow('process.exit');
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe('valid fixture content', () => {
  it('matches the expected resolved shape', () => {
    const config = loadConfigFromString(readFixture('valid.yaml'));

    expect(config).toMatchObject({
      adminGroup: 'system-admins',
      groups: ['media-users', 'media-admins'],
      applications: [
        {
          id: 'media',
          requestable: false,
          services: [
            { id: 'jellyfin', groups: ['media-users'] },
            { id: 'db', groups: ['media-admins'] },
          ],
        },
      ],
    });
  });
});
