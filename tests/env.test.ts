import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';

describe('env validation', () => {
  const envSchema = z.object({
    DISCORD_TOKEN: z.string().min(1),
    DISCORD_APP_ID: z.string().min(1),
    ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-f]+$/i),
    DATABASE_URL: z.string().url(),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  });

  it('should accept valid env', () => {
    const result = envSchema.safeParse({
      DISCORD_TOKEN: 'token',
      DISCORD_APP_ID: 'app-id',
      ENCRYPTION_KEY: '0'.repeat(64),
      DATABASE_URL: 'postgresql://bot:bot@db:5432/scholarwatch',
      LOG_LEVEL: 'info',
    });
    expect(result.success).toBe(true);
  });

  it('should default LOG_LEVEL to info', () => {
    const result = envSchema.safeParse({
      DISCORD_TOKEN: 'token',
      DISCORD_APP_ID: 'app-id',
      ENCRYPTION_KEY: '0'.repeat(64),
      DATABASE_URL: 'postgresql://bot:bot@db:5432/scholarwatch',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.LOG_LEVEL).toBe('info');
    }
  });

  it('should reject missing required fields', () => {
    const result = envSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject invalid ENCRYPTION_KEY', () => {
    const result = envSchema.safeParse({
      DISCORD_TOKEN: 'token',
      DISCORD_APP_ID: 'app-id',
      ENCRYPTION_KEY: 'too-short',
      DATABASE_URL: 'postgresql://bot:bot@db:5432/scholarwatch',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid LOG_LEVEL', () => {
    const result = envSchema.safeParse({
      DISCORD_TOKEN: 'token',
      DISCORD_APP_ID: 'app-id',
      ENCRYPTION_KEY: '0'.repeat(64),
      DATABASE_URL: 'postgresql://bot:bot@db:5432/scholarwatch',
      LOG_LEVEL: 'verbose',
    });
    expect(result.success).toBe(false);
  });
});
