import {
  ActionRowBuilder,
  type ButtonInteraction,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { configService } from '../../core/ConfigService.js';
import { t } from '../../i18n/index.js';
import { buildKeywordsEmbed } from '../../utils/embeds.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('modal:rmkw');

export async function showRemoveModal(interaction: ButtonInteraction, lang: string, watchChannelId: number): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`kw_remove_modal:${watchChannelId}`)
    .setTitle(t('commands.keywords.remove.modal_title', lang));

  const input = new TextInputBuilder()
    .setCustomId('kw_id')
    .setLabel(t('commands.keywords.remove.input_label', lang))
    .setPlaceholder(t('commands.keywords.remove.input_placeholder', lang))
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(10);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

export async function handleRemoveSubmit(interaction: ModalSubmitInteraction, watchChannelId: number): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = await configService.getOrCreateGuild(guildId);
  const lang = guild.language;
  const raw = interaction.fields.getTextInputValue('kw_id').trim();

  const position = parseInt(raw, 10);
  if (isNaN(position) || position < 1) {
    await interaction.reply({
      content: t('commands.keywords.remove.invalid', lang),
      flags: ['Ephemeral'],
    });
    return;
  }

  const allKeywords = await configService.getKeywords(watchChannelId);
  const target = allKeywords[position - 1];
  if (!target) {
    await interaction.reply({
      content: t('commands.keywords.remove.not_found', lang, { id: String(position) }),
      flags: ['Ephemeral'],
    });
    return;
  }

  await configService.removeKeyword(watchChannelId, target.id);
  logger.debug({ guildId, watchChannelId, keywordId: target.id, position }, 'Keyword removed via modal');

  const { keywords, totalPages } = await configService.getKeywordsPaginated(watchChannelId, 1);
  const embed = buildKeywordsEmbed(keywords, lang, 1, totalPages);

  await interaction.reply({
    content: t('commands.keywords.remove.success', lang, { id: String(position) }),
    embeds: [embed],
    flags: ['Ephemeral'],
  });
}
