import {
  type ChatInputCommandInteraction,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { configService } from '../../core/ConfigService.js';
import { t } from '../../i18n/index.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('cmd:keywords');
import { buildKeywordsEmbed, buildKeywordsComponents } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('keywords')
  .setDescription('Manage watch keywords for a channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption((opt) =>
    opt
      .setName('channel')
      .setDescription('Target watch channel (defaults to current channel)')
      .addChannelTypes(ChannelType.GuildText),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  logger.debug({ guildId, userId: interaction.user.id }, 'Command invoked');
  const guild = await configService.getOrCreateGuild(guildId);
  const lang = guild.language;

  const channelOption = interaction.options.getChannel('channel');
  const channelId = channelOption?.id ?? interaction.channelId;

  const wc = await configService.getWatchChannel(guildId, channelId);
  if (!wc) {
    await interaction.reply({
      content: t('commands.keywords.not_a_watch_channel', lang, { channel: `<#${channelId}>` }),
      flags: ['Ephemeral'],
    });
    return;
  }

  const { keywords, page, totalPages } = await configService.getKeywordsPaginated(wc.id, 1);
  const embed = buildKeywordsEmbed(keywords, lang, page, totalPages, channelId);
  const components = buildKeywordsComponents(lang, page, totalPages, wc.id);

  await interaction.reply({ embeds: [embed], components, flags: ['Ephemeral'] });
}
