import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const exampleConfigPath = join(repoRoot, 'deploy/config/dashboard.yaml');
const iconsDir = join(here, '../../../static/icons');

type ExampleConfig = {
  applications?: Array<{ id?: string; icon?: string }>;
};

describe('application icon assets', () => {
  it('ships a committed file for every icon in the example config', () => {
    const raw = readFileSync(exampleConfigPath, 'utf8');
    const config = parseYaml(raw) as ExampleConfig;
    const applications = config.applications ?? [];

    expect(applications.length).toBeGreaterThan(0);

    for (const app of applications) {
      expect(app.icon, `application ${app.id ?? '(missing id)'} must declare icon`).toBeTruthy();
      const iconPath = join(iconsDir, app.icon!);
      expect(existsSync(iconPath), `missing icon asset for ${app.id}: expected ${iconPath}`).toBe(
        true,
      );
    }
  });

  it('ships the placeholder used when an icon is missing', () => {
    expect(existsSync(join(iconsDir, 'placeholder.svg'))).toBe(true);
  });
});
