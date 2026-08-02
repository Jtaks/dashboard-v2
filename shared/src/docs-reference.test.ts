import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { applicationConfigSchema, configSchema, serviceConfigSchema } from './config.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const docsIntegrator = join(repoRoot, 'docs/integrator');

/** Deployment env vars the API reads (config, db, vapid, env modules). */
export const CODE_DEPLOYMENT_ENV_KEYS = [
  'CONFIG_PATH',
  'DATABASE_PATH',
  'VAPID_KEYS_PATH',
  'VAPID_SUBJECT',
  'DOCKER_PROXY_URL',
  'ALLOWED_ORIGIN',
  'AUTHELIA_LOGOUT_URL',
  'PORT',
  'LOG_LEVEL',
] as const;

function readDoc(name: string): string {
  return readFileSync(join(docsIntegrator, name), 'utf8');
}

function extractFencedKeys(markdown: string, fence: string): string[] {
  const pattern = new RegExp('```' + fence + '\\r?\\n([\\s\\S]*?)```');
  const match = pattern.exec(markdown);
  if (!match?.[1]) {
    throw new Error(`Missing \`\`\`${fence} block in integrator docs`);
  }
  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function schemaKeysFromZod(): string[] {
  const keys = new Set<string>();
  for (const key of Object.keys(configSchema.shape)) {
    keys.add(key);
  }
  for (const key of Object.keys(applicationConfigSchema.shape)) {
    keys.add(`applications.${key}`);
  }
  for (const key of Object.keys(serviceConfigSchema.shape)) {
    keys.add(`applications.services.${key}`);
  }
  return [...keys].sort();
}

describe('integrator docs ↔ schema / env drift', () => {
  it('documents every zod config schema key', () => {
    const documented = new Set(
      extractFencedKeys(readDoc('configuration.md'), 'documented-schema-keys'),
    );
    const schemaKeys = schemaKeysFromZod();

    const missing = schemaKeys.filter((key) => !documented.has(key));
    expect(
      missing,
      `schema keys missing from docs/integrator/configuration.md: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('documents every deployment env var the API reads', () => {
    const documented = new Set(extractFencedKeys(readDoc('environment.md'), 'documented-env-keys'));
    const missing = CODE_DEPLOYMENT_ENV_KEYS.filter((key) => !documented.has(key));
    expect(
      missing,
      `env keys missing from docs/integrator/environment.md: ${missing.join(', ')}`,
    ).toEqual([]);
  });
});
