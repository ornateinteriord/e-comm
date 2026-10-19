import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
const level = process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info');

export const logger = pino({
  level,
  ...(isDev
    ? {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    }
    : {}),
  base: { service: process.env.SERVICE_NAME ?? 'ornate' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.passwordHash',
      'body.inwardPrice',
      'body.pricing.inwardPrice',
    ],
    censor: '[REDACTED]',
  },
});

export type Logger = typeof logger;

/** Creates a child logger with a fixed module label */
export function createLogger(module: string): Logger {
  return logger.child({ module }) as Logger;
}
