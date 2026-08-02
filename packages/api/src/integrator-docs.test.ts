import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  APPLICATION_CONFIG_KEYS,
  SERVICE_CONFIG_KEYS,
  TOP_LEVEL_CONFIG_KEYS,
} from '@dashboard/shared';
import { describe, expect, it } from 'vitest';

import { ENV_VARIABLES } from './lib/env-vars.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const CONFIG_REFERENCE = join(REPO_ROOT, 'docs', 'config-reference.md');
const ENV_REFERENCE = join(REPO_ROOT, 'docs', 'environment-variables.md');

/** Keys documented as the first column of a markdown table row: | `key` | */
function extractDocumentedKeys(markdown: string): Set<string> {
  const keys = new Set<string>();
  const pattern = /^\|\s*`([^`]+)`\s*\|/gm;

  for (const match of markdown.matchAll(pattern)) {
    keys.add(match[1]);
  }

  return keys;
}

/** Env vars documented as the first column: | `CONFIG_PATH` | or | CONFIG_PATH | */
function extractDocumentedEnvVars(markdown: string): Set<string> {
  const vars = new Set<string>();
  const pattern = /^\|\s*(?:`)?([A-Z][A-Z0-9_]+)(?:`)?\s*\|/gm;

  for (const match of markdown.matchAll(pattern)) {
    vars.add(match[1]);
  }

  return vars;
}

describe('integrator documentation drift', () => {
  it('documents every config key accepted by the schema', () => {
    const markdown = readFileSync(CONFIG_REFERENCE, 'utf8');
    const documented = extractDocumentedKeys(markdown);

    const expected = new Set<string>([
      ...TOP_LEVEL_CONFIG_KEYS,
      ...APPLICATION_CONFIG_KEYS,
      ...SERVICE_CONFIG_KEYS,
    ]);

    const missing = [...expected].filter((key) => !documented.has(key));
    const extra = [...documented].filter((key) => !expected.has(key));

    expect(missing, `keys missing from ${CONFIG_REFERENCE}`).toEqual([]);
    expect(extra, `unexpected keys in ${CONFIG_REFERENCE}`).toEqual([]);
  });

  it('documents every environment variable read by readEnv()', () => {
    const markdown = readFileSync(ENV_REFERENCE, 'utf8');
    const documented = extractDocumentedEnvVars(markdown);

    const expected = new Set<string>(ENV_VARIABLES);

    const missing = [...expected].filter((name) => !documented.has(name));
    const extra = [...documented].filter((name) => !expected.has(name));

    expect(missing, `variables missing from ${ENV_REFERENCE}`).toEqual([]);
    expect(extra, `unexpected variables in ${ENV_REFERENCE}`).toEqual([]);
  });

  it('does not publish a private VAPID key in integrator docs', () => {
    const integrator = readFileSync(join(REPO_ROOT, 'docs', 'integrator.md'), 'utf8');
    const configRef = readFileSync(CONFIG_REFERENCE, 'utf8');
    const envRef = readFileSync(ENV_REFERENCE, 'utf8');
    const deployNotes = readFileSync(join(REPO_ROOT, 'deploy', 'INTEGRATOR.md'), 'utf8');

    const combined = `${integrator}\n${configRef}\n${envRef}\n${deployNotes}`;

    expect(combined).not.toMatch(/UUxI4O8-FbRovA27ayXfCs0_XYNgeKqUaRbcRx8y6FU/);
  });
});
