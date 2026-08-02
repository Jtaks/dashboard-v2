/**
 * Start the local docker compose stack (Caddy + socket-proxy), ensure shared is
 * built, then run hot-reloaded API + client (+ shared watch) with api.env loaded.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const apiEnvPath = join(repoRoot, 'dev-environment', 'api.env');

function loadApiEnv() {
  const env = { ...process.env };
  for (const line of readFileSync(apiEnvPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit', shell: true });
  return result.status ?? 1;
}

function runForeground(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: true,
      env,
    });

    const forward = (signal) => {
      if (!child.killed) child.kill(signal);
    };
    process.on('SIGINT', forward);
    process.on('SIGTERM', forward);

    child.on('exit', (code, signal) => {
      process.off('SIGINT', forward);
      process.off('SIGTERM', forward);
      if (signal) {
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });
  });
}

mkdirSync(join(repoRoot, 'dev-environment', 'data'), { recursive: true });

const compose = run('docker', [
  'compose',
  '-f',
  'dev-environment/docker-compose.yml',
  'up',
  '-d',
]);
if (compose !== 0) {
  process.exit(compose);
}

const sharedBuild = run('pnpm', ['--filter', '@dashboard/shared', 'build']);
if (sharedBuild !== 0) {
  process.exit(sharedBuild);
}

const env = loadApiEnv();
const code = await runForeground(
  'pnpm',
  [
    '-r',
    '--parallel',
    '--filter',
    '@dashboard/shared',
    '--filter',
    '@dashboard/api',
    '--filter',
    '@dashboard/client',
    'dev',
  ],
  env,
);

process.exit(code);
