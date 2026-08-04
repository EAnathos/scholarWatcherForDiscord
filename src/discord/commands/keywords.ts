import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { configService } from '../../core/ConfigService.js';
import { t } from '../../i18n/index.js';
import { buildKeywordsEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('keywords')
  .setDescription('Manage watch keywords for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = await configService.getOrCreateGuild(guildId);
  const lang = guild.language;

  const { keywords, totalPages } = await configService.getKeywordsPaginated(guildId, 1);

  const embed = buildKeywordsEmbed(keywords, lang, 1, totalPages);

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

  const components: ActionRowBuilder<ButtonBuilder>[] = [buttons];

  if (totalPages > 1) {
    const pagination = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('kw_prev_1')
        .setLabel('◀')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('kw_next_1')
        .setLabel('▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(totalPages <= 1),
    );
    components.push(pagination);
  }

  await interaction.reply({ embeds: [embed], components, flags: ['Ephemeral'] });
}
