export interface Logger {
  info: (obj: Record<string, unknown> | string, msg?: string) => void;
  error: (obj: Record<string, unknown> | string, msg?: string) => void;
  warn: (obj: Record<string, unknown> | string, msg?: string) => void;
  debug: (obj: Record<string, unknown> | string, msg?: string) => void;
}

export function createLogger(module: string): Logger {
  const format = (level: string, obj: Record<string, unknown> | string, msg?: string) => {
    const timestamp = new Date().toISOString();
    if (typeof obj === 'string') {
      return JSON.stringify({ timestamp, level, module, message: obj });
    }
    return JSON.stringify({ timestamp, level, module, message: msg, ...obj });
  };

  return {
    info: (obj, msg) => console.log(format('info', obj, msg)),
    error: (obj, msg) => console.error(format('error', obj, msg)),
    warn: (obj, msg) => console.warn(format('warn', obj, msg)),
    debug: (obj, msg) => console.debug(format('debug', obj, msg)),
  };
}
