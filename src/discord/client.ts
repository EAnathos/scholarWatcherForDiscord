import {
  ChannelType,
  Client,
  type ChatInputCommandInteraction,
  Events,
  GatewayIntentBits,
  type Interaction,
  type TextChannel,
} from 'discord.js';
import { configService } from '../core/ConfigService.js';
import { WatchService } from '../core/WatchService.js';
import { t } from '../i18n/index.js';
import { logger } from '../utils/logger.js';
import { buildKeywordsEmbed, buildKeywordsComponents, buildWelcomeEmbed } from '../utils/embeds.js';
import * as keywordsCommand from './commands/keywords.js';
import * as watchCommand from './commands/watch.js';
import { showAddModal, handleAddSubmit } from './interactions/addKeywordModal.js';
import { showRemoveModal, handleRemoveSubmit } from './interactions/removeKeywordModal.js';
import { handleApiKeySubmit } from './interactions/apiKeyModal.js';
import { writeFileSync } from 'node:fs';

export const HEALTH_FILE = '/tmp/healthy';

const commands = new Map<string, { execute: (i: ChatInputCommandInteraction) => Promise<void> }>();
commands.set('keywords', keywordsCommand);
commands.set('watch', watchCommand);

export function createBot(): { client: Client; watchService: WatchService } {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  const watchService = new WatchService(client);
  watchCommand.setWatchService(watchService);

  client.on(Events.ClientReady, (c) => {
    logger.info({ user: c.user.tag }, 'Bot ready');
    writeFileSync(HEALTH_FILE, new Date().toISOString());
    void watchService.scheduleAll();
  });

  client.on(Events.InteractionCreate, (interaction: Interaction) => {
    void handleInteraction(interaction);
  });

  client.on(Events.GuildCreate, (guild) => {
    void handleGuildCreate(client, guild.id);
  });

  client.on(Events.GuildDelete, (guild) => {
    void configService.disableGuild(guild.id).catch((err) => {
      logger.error({ error: err, guildId: guild.id }, 'Failed to disable guild');
    });
    watchService.unscheduleGuild(guild.id);
  });

  setInterval(() => {
    writeFileSync(HEALTH_FILE, new Date().toISOString());
  }, 30_000);

  return { client, watchService };
}

function parseCustomId(customId: string): { action: string; watchChannelId: number; extra?: string } | null {
  const parts = customId.split(':');
  if (parts.length < 2) return null;
  const watchChannelId = parseInt(parts[1], 10);
  if (isNaN(watchChannelId)) return null;
  return { action: parts[0], watchChannelId, extra: parts[2] };
}

async function handleInteraction(interaction: Interaction): Promise<void> {
  try {
    if (!interaction.guildId) return;

    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (command) {
        await command.execute(interaction);
      }
      return;
    }

    if (interaction.isButton()) {
      const guildId = interaction.guildId;
      const guild = await configService.getOrCreateGuild(guildId);
      const lang = guild.language;

      const parsed = parseCustomId(interaction.customId);
      if (!parsed) return;

      if (parsed.action === 'kw_add') {
        await showAddModal(interaction, lang, parsed.watchChannelId);
        return;
      }

      if (parsed.action === 'kw_remove') {
        await showRemoveModal(interaction, lang, parsed.watchChannelId);
        return;
      }

      if (parsed.action === 'kw_prev' || parsed.action === 'kw_next') {
        const currentPage = parseInt(parsed.extra ?? '1', 10);
        const page = parsed.action === 'kw_prev' ? currentPage - 1 : currentPage + 1;
        await handlePagination(interaction, lang, parsed.watchChannelId, page);
        return;
      }
    }

    if (interaction.isModalSubmit()) {
      const parsed = parseCustomId(interaction.customId);

      if (parsed?.action === 'kw_add_modal') {
        await handleAddSubmit(interaction, parsed.watchChannelId);
        return;
      }
      if (parsed?.action === 'kw_remove_modal') {
        await handleRemoveSubmit(interaction, parsed.watchChannelId);
        return;
      }
      if (interaction.customId === 'apikey_set_modal') {
        await handleApiKeySubmit(interaction);
        return;
      }
    }
  } catch (error) {
    logger.error({ error }, 'Interaction handler error');
    const guild = interaction.guildId
      ? await configService.getGuild(interaction.guildId)
      : null;
    const lang = guild?.language ?? 'en';
    const errorMsg = t('errors.generic', lang);

    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMsg, flags: ['Ephemeral'] }).catch(() => {});
      } else {
        await interaction.reply({ content: errorMsg, flags: ['Ephemeral'] }).catch(() => {});
      }
    }
  }
}

async function handlePagination(
  interaction: import('discord.js').ButtonInteraction,
  lang: string,
  watchChannelId: number,
  requestedPage: number,
): Promise<void> {
  const { keywords, page, totalPages } = await configService.getKeywordsPaginated(watchChannelId, requestedPage);
  const embed = buildKeywordsEmbed(keywords, lang, page, totalPages);
  const components = buildKeywordsComponents(lang, page, totalPages, watchChannelId);

  await interaction.update({ embeds: [embed], components });
}

async function handleGuildCreate(client: Client, guildId: string): Promise<void> {
  try {
    const guildConfig = await configService.getOrCreateGuild(guildId);
    const lang = guildConfig.language;

    const discordGuild = await client.guilds.fetch(guildId);

    const channels = await discordGuild.channels.fetch();
    const textChannel = channels.find(
      (ch): ch is TextChannel =>
        ch !== null &&
        ch.type === ChannelType.GuildText &&
        ch.permissionsFor(discordGuild.members.me!)?.has('SendMessages') === true,
    );

    if (textChannel) {
      const embed = buildWelcomeEmbed(lang);
      await textChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    logger.error({ error, guildId }, 'Failed to handle guild create');
  }
}
