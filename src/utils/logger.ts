import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export function createLogger(module: string): pino.Logger {
  return logger.child({ module });
}
