import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
import { buildKeywordsEmbed, buildWelcomeEmbed } from '../utils/embeds.js';
import * as keywordsCommand from './commands/keywords.js';
import * as watchCommand from './commands/watch.js';
import { showAddModal, handleAddSubmit } from './interactions/addKeywordModal.js';
import { showRemoveModal, handleRemoveSubmit } from './interactions/removeKeywordModal.js';
import { writeFileSync } from 'node:fs';

const HEALTH_FILE = '/tmp/healthy';

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

async function handleInteraction(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (command) {
        await command.execute(interaction);
      }
      return;
    }

    if (interaction.isButton()) {
      const guildId = interaction.guildId!;
      const guild = await configService.getOrCreateGuild(guildId);
      const lang = guild.language;

      if (interaction.customId === 'kw_add') {
        await showAddModal(interaction, lang);
        return;
      }

      if (interaction.customId === 'kw_remove') {
        await showRemoveModal(interaction, lang);
        return;
      }

      if (
        interaction.customId.startsWith('kw_prev_') ||
        interaction.customId.startsWith('kw_next_')
      ) {
        const currentPage = parseInt(interaction.customId.split('_')[2], 10);
        const page = interaction.customId.startsWith('kw_prev_')
          ? currentPage - 1
          : currentPage + 1;
        await handlePagination(interaction, guildId, lang, page);
        return;
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'kw_add_modal') {
        await handleAddSubmit(interaction);
        return;
      }
      if (interaction.customId === 'kw_remove_modal') {
        await handleRemoveSubmit(interaction);
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
  guildId: string,
  lang: string,
  page: number,
): Promise<void> {
  const { keywords, totalPages } = await configService.getKeywordsPaginated(guildId, page);
  const safePage = Math.min(Math.max(1, page), totalPages);

  const embed = buildKeywordsEmbed(keywords, lang, safePage, totalPages);

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('kw_add')
      .setLabel(t('commands.keywords.add.button', lang))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('kw_remove')
      .setLabel(t('commands.keywords.remove.button', lang))
      .setStyle(ButtonStyle.Danger),
  );

  const pagination = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`kw_prev_${safePage}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage <= 1),
    new ButtonBuilder()
      .setCustomId(`kw_next_${safePage}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= totalPages),
  );

  await interaction.update({ embeds: [embed], components: [buttons, pagination] });
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
        ch.type === 0 &&
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
