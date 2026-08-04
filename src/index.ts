import './i18n/index.js';
import { createBot } from './discord/client.js';
import { env } from './config/env.js';
import { prisma } from './prisma/client.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  logger.info('Starting ScholarWatch bot…');

  await prisma.$connect();
  logger.info('Database connected');

  const { client } = createBot();
  await client.login(env.DISCORD_TOKEN);
}

process.on('unhandledRejection', (error) => {
  logger.error({ error }, 'Unhandled rejection');
});

process.on('SIGINT', async () => {
  logger.info('Shutting down…');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down…');
  await prisma.$disconnect();
  process.exit(0);
});

void main();
