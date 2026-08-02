import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

import {
  PLACEHOLDER_ICON_PATH,
  resolveIconPath,
  resolveIconSrc,
} from './icon.js';

const clientRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const repoRoot = join(clientRoot, '../..');
const exampleConfigPath = join(repoRoot, 'config/dashboard.yaml');
const iconsDir = join(clientRoot, 'static/icons');

describe('resolveIconPath', () => {
  it('resolves the icon filename against /icons/', () => {
    expect(resolveIconPath('media.svg')).toBe('/icons/media.svg');
    expect(resolveIconPath('app-one.png')).toBe('/icons/app-one.png');
  });
});

describe('resolveIconSrc', () => {
  it('returns the icon path when the asset is available', () => {
    expect(resolveIconSrc('media.svg', false)).toBe('/icons/media.svg');
  });

  it('returns the placeholder path when the asset is missing', () => {
    expect(resolveIconSrc('missing.svg', true)).toBe(PLACEHOLDER_ICON_PATH);
  });
});

describe('example configuration icon assets', () => {
  it('ships a placeholder asset for missing icons', () => {
    expect(existsSync(join(iconsDir, 'placeholder.svg'))).toBe(true);
  });

  it('has a committed icon file for every application in the example configuration', () => {
    const config = parse(readFileSync(exampleConfigPath, 'utf8')) as {
      applications: Array<{ icon: string }>;
    };

    const missingIcons = config.applications
      .map((application) => application.icon)
      .filter((icon) => !existsSync(join(iconsDir, icon)));

    expect(missingIcons).toEqual([]);
  });
});
