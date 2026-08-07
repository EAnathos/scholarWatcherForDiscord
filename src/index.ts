import './i18n/index.js';
import { createBot, HEALTH_FILE } from './discord/client.js';
import { env } from './config/env.js';
import { prisma } from './prisma/client.js';
import { logger } from './utils/logger.js';
import { unlinkSync } from 'node:fs';

async function main(): Promise<void> {
  logger.info('Starting ScholarWatch bot…');

  await prisma.$connect();
  logger.info('Database connected');

  const { client } = createBot();
  await client.login(env.DISCORD_TOKEN);

  async function shutdown(): Promise<void> {
    logger.info('Shutting down…');
    client.destroy();
    await prisma.$disconnect();
    try { unlinkSync(HEALTH_FILE); } catch {}
    process.exit(0);
  }

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

process.on('unhandledRejection', (error) => {
  logger.error({ error }, 'Unhandled rejection');
});

void main();
