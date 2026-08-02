import type { LogLevel } from './env.js';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export type Logger = {
  level: LogLevel;
  debug: (fields: LogFields) => void;
  info: (fields: LogFields) => void;
  warn: (fields: LogFields) => void;
  error: (fields: LogFields) => void;
};

function write(level: LogLevel, minLevel: LogLevel, fields: LogFields): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) {
    return;
  }
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    ...fields,
  });
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/** Structured JSON logger. Never log header values or identity claims. */
export function createLogger(level: LogLevel = 'info'): Logger {
  return {
    level,
    debug: (fields) => write('debug', level, fields),
    info: (fields) => write('info', level, fields),
    warn: (fields) => write('warn', level, fields),
    error: (fields) => write('error', level, fields),
  };
}

/** Adapt structured logger to the string-based ConfigLogger / EnvLogger shape. */
export function asMessageLogger(logger: Logger): {
  warn: (message: string) => void;
  error: (message: string) => void;
} {
  return {
    warn: (message) => logger.warn({ msg: message }),
    error: (message) => logger.error({ msg: message }),
  };
}
