import { getServerEnv } from './env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY = /(password|secret|token|authorization|cookie|session)/i;

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
        if (SENSITIVE_KEY.test(key)) {
          return [key, '[redacted]'];
        }
        return [key, sanitize(nested)];
      }),
    );
  }
  return value;
}

function write(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
  let configured: LogLevel = 'info';
  try {
    configured = getServerEnv().LOG_LEVEL;
  } catch {
    configured = 'info';
  }

  if (levelWeight[level] < levelWeight[configured]) {
    return;
  }

  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(fields ? (sanitize(fields) as Record<string, unknown>) : {}),
  };

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => write('debug', message, fields),
  info: (message: string, fields?: Record<string, unknown>) => write('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write('warn', message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write('error', message, fields),
};
