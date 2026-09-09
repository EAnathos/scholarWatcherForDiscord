import pino from 'pino';
import { z } from 'zod/v4';

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_APP_ID: z.string().min(1),
  ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-f]+$/i),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

const bootLogger = pino({ name: 'env' });

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    bootLogger.fatal({ errors: z.prettifyError(result.error) }, 'Invalid environment variables');
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
