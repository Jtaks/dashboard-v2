/**
 * Standalone doc drift check. Builds shared types first, then runs the vitest suite
 * that compares integrator markdown against CONFIG_KEYS and ENV_VARIABLES.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: true });
  return result.status ?? 1;
}

const sharedBuild = run('pnpm', ['--filter', '@dashboard/shared', 'build']);
if (sharedBuild !== 0) {
  process.exit(sharedBuild);
}

const test = run('pnpm', [
  '--filter',
  '@dashboard/api',
  'exec',
  'vitest',
  'run',
  'src/integrator-docs.test.ts',
]);

process.exit(test);
