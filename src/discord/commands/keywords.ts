import {
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { configService } from '../../core/ConfigService.js';
import { buildKeywordsEmbed, buildKeywordsComponents } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('keywords')
  .setDescription('Manage watch keywords for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = await configService.getOrCreateGuild(guildId);
  const lang = guild.language;

  const { keywords, page, totalPages } = await configService.getKeywordsPaginated(guildId, 1);
  const embed = buildKeywordsEmbed(keywords, lang, page, totalPages);
  const components = buildKeywordsComponents(lang, page, totalPages);

  await interaction.reply({ embeds: [embed], components, flags: ['Ephemeral'] });
}
