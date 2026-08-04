import { REST, Routes } from 'discord.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { data as keywordsData } from './commands/keywords.js';
import { data as watchData } from './commands/watch.js';

const commands = [keywordsData.toJSON(), watchData.toJSON()];

const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

const guildId = process.argv.find((arg) => arg.startsWith('--guild='))?.split('=')[1];

async function deploy(): Promise<void> {
  try {
    logger.info({ count: commands.length, guildId: guildId ?? 'global' }, 'Deploying commands');

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(env.DISCORD_APP_ID, guildId), {
        body: commands,
      });
    } else {
      await rest.put(Routes.applicationCommands(env.DISCORD_APP_ID), { body: commands });
    }

    logger.info('Commands deployed successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to deploy commands');
    process.exit(1);
  }
}

void deploy();
