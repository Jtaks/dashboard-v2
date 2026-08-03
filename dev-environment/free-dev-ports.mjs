/**
 * Free ports and orphan watchers left behind by a previous `pnpm dev:local`.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORTS = [3000, 5173];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function listeningPids(port) {
  if (process.platform === 'win32') {
    try {
      const out = execSync('netstat -ano', { encoding: 'utf8' });
      const pids = new Set();
      const re = new RegExp(`:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`, 'i');
      for (const line of out.split(/\r?\n/)) {
        const match = line.match(re);
        if (match) {
          pids.add(match[1]);
        }
      }
      return [...pids];
    } catch {
      return [];
    }
  }

  try {
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
    return out
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Node PIDs still running dashboard-v2 watchers from a prior session. */
function orphanWatcherPids() {
  const pids = new Set();
  const isOurs = (cmd) => {
    if (!cmd) return false;
    // Absolute paths under this repo, or relative flags unique to our scripts.
    if (cmd.includes(repoRoot)) {
      return /concurrently|nodemon|vite\.js|api\.env|preserveWatchOutput|tsc.*--watch|--watch.*api\.env/.test(
        cmd,
      );
    }
    return /dev-environment[/\\]api\.env|--env-file=.*api\.env/.test(cmd);
  };

  if (process.platform === 'win32') {
    try {
      const out = execSync(
        'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name = \'node.exe\'\\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"',
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
      );
      const parsed = JSON.parse(out || '[]');
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      for (const row of rows) {
        const cmd = row?.CommandLine ?? '';
        const pid = String(row?.ProcessId ?? '');
        if (pid && isOurs(cmd)) {
          pids.add(pid);
        }
      }
    } catch {
      // Best-effort.
    }
    return [...pids];
  }

  try {
    const out = execSync('ps -Ao pid=,command=', { encoding: 'utf8' });
    for (const line of out.split('\n')) {
      if (!isOurs(line)) continue;
      const match = line.trim().match(/^(\d+)\s+/);
      if (match) pids.add(match[1]);
    }
  } catch {
    // Best-effort.
  }
  return [...pids];
}

function stopPid(pid, reason) {
  if (!pid || pid === '0' || pid === String(process.pid)) {
    return;
  }
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(Number(pid), 'SIGTERM');
    }
    console.log(`stopped pid ${pid} (${reason})`);
  } catch {
    // Already gone.
  }
}

for (const port of PORTS) {
  for (const pid of listeningPids(port)) {
    stopPid(pid, `port ${port}`);
  }
}

for (const pid of orphanWatcherPids()) {
  stopPid(pid, 'orphan watcher');
}
