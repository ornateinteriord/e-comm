export interface Logger {
  info: (obj: Record<string, unknown> | string, msg?: string) => void;
  error: (obj: Record<string, unknown> | string, msg?: string) => void;
  warn: (obj: Record<string, unknown> | string, msg?: string) => void;
  debug: (obj: Record<string, unknown> | string, msg?: string) => void;
  child: (bindings: Record<string, unknown>) => Logger;
}

const REDACTED_KEYS = new Set([
  'password',
  'passwordHash',
  'authorization',
  'cookie',
  'inwardPrice',
]);

function redact(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redact(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Creates a structured, universal logger with module labeling and sensitive data redaction */
export function createLogger(module: string, parentBindings: Record<string, unknown> = {}): Logger {
  const isDev = process.env.NODE_ENV !== 'production';

  const logFn = (level: string, obj: Record<string, unknown> | string, msg?: string) => {
    const timestamp = new Date().toISOString();
    let message = msg;
    let details: Record<string, unknown> = { ...parentBindings };

    if (typeof obj === 'string') {
      message = obj;
    } else if (typeof obj === 'object' && obj !== null) {
      details = { ...details, ...(redact(obj) as Record<string, unknown>) };
    }

    if (isDev) {
      const extra = Object.keys(details).length > 0 ? JSON.stringify(details) : '';
      const prefix = `[${timestamp}] ${level.toUpperCase()} (${module}):`;
      if (level === 'error') {
        console.error(prefix, message ?? '', extra);
      } else if (level === 'warn') {
        console.warn(prefix, message ?? '', extra);
      } else {
        console.log(prefix, message ?? '', extra);
      }
    } else {
      const output = JSON.stringify({
        timestamp,
        level,
        module,
        message,
        ...details,
      });
      if (level === 'error') {
        console.error(output);
      } else if (level === 'warn') {
        console.warn(output);
      } else {
        console.log(output);
      }
    }
  };

  const instance: Logger = {
    info: (obj, msg) => logFn('info', obj, msg),
    error: (obj, msg) => logFn('error', obj, msg),
    warn: (obj, msg) => logFn('warn', obj, msg),
    debug: (obj, msg) => logFn('debug', obj, msg),
    child: (bindings: Record<string, unknown>) =>
      createLogger(module, { ...parentBindings, ...bindings }),
  };

  return instance;
}

export const logger = createLogger(process.env.SERVICE_NAME ?? 'ornate');
