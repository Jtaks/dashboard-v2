const LEVELS = ['debug', 'info', 'warn', 'error'] as const;

type LogLevel = (typeof LEVELS)[number];

function levelIndex(level: string): number {
  const index = LEVELS.indexOf(level as LogLevel);
  return index === -1 ? LEVELS.indexOf('info') : index;
}

export function createLogger(logLevel: string) {
  const threshold = levelIndex(logLevel);

  function shouldLog(level: LogLevel): boolean {
    return levelIndex(level) >= threshold;
  }

  return {
    debug(message: string, fields?: Record<string, unknown>) {
      if (shouldLog('debug')) {
        console.debug(format('debug', message, fields));
      }
    },
    info(message: string, fields?: Record<string, unknown>) {
      if (shouldLog('info')) {
        console.info(format('info', message, fields));
      }
    },
    warn(message: string, fields?: Record<string, unknown>) {
      if (shouldLog('warn')) {
        console.warn(format('warn', message, fields));
      }
    },
    error(message: string, fields?: Record<string, unknown>) {
      if (shouldLog('error')) {
        console.error(format('error', message, fields));
      }
    },
    request(route: string, status: number) {
      if (shouldLog('info')) {
        console.info(format('info', 'request completed', { route, status }));
      }
    },
  };
}

function format(level: string, message: string, fields?: Record<string, unknown>): string {
  if (!fields || Object.keys(fields).length === 0) {
    return `[${level}] ${message}`;
  }

  return `[${level}] ${message} ${JSON.stringify(fields)}`;
}
