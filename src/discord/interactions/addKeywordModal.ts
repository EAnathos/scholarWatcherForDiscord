import {
  ActionRowBuilder,
  type ButtonInteraction,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { z } from 'zod/v4';
import { configService } from '../../core/ConfigService.js';
import { t } from '../../i18n/index.js';
import { buildKeywordsEmbed } from '../../utils/embeds.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('modal:addkw');

const keywordSchema = z.string().min(2).max(200);

export async function showAddModal(interaction: ButtonInteraction, lang: string, watchChannelId: number): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`kw_add_modal:${watchChannelId}`)
    .setTitle(t('commands.keywords.add.modal_title', lang));

  const input = new TextInputBuilder()
    .setCustomId('kw_value')
    .setLabel(t('commands.keywords.add.input_label', lang))
    .setPlaceholder(t('commands.keywords.add.input_placeholder', lang))
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(200);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

export async function handleAddSubmit(interaction: ModalSubmitInteraction, watchChannelId: number): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = await configService.getOrCreateGuild(guildId);
  const lang = guild.language;
  const value = interaction.fields.getTextInputValue('kw_value').trim();

  const parsed = keywordSchema.safeParse(value);
  if (!parsed.success) {
    await interaction.reply({
      content: t('commands.keywords.add.invalid', lang),
      flags: ['Ephemeral'],
    });
    return;
  }

  const keyword = await configService.addKeyword(watchChannelId, value);
  if (!keyword) {
    logger.debug({ guildId, watchChannelId, value }, 'Duplicate keyword rejected');
    await interaction.reply({
      content: t('commands.keywords.add.duplicate', lang, { keyword: value }),
      flags: ['Ephemeral'],
    });
    return;
  }

  const { keywords, totalPages } = await configService.getKeywordsPaginated(watchChannelId, 1);
  const embed = buildKeywordsEmbed(keywords, lang, 1, totalPages);

  await interaction.reply({
    content: t('commands.keywords.add.success', lang, { keyword: value }),
    embeds: [embed],
    flags: ['Ephemeral'],
  });
}
