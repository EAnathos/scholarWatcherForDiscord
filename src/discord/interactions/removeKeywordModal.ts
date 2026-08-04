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

export async function showRemoveModal(interaction: ButtonInteraction, lang: string): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('kw_remove_modal')
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

export async function handleRemoveSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = await configService.getOrCreateGuild(guildId);
  const lang = guild.language;
  const raw = interaction.fields.getTextInputValue('kw_id').trim();

  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    await interaction.reply({
      content: t('commands.keywords.remove.invalid', lang),
      flags: ['Ephemeral'],
    });
    return;
  }

  const removed = await configService.removeKeyword(guildId, id);
  if (!removed) {
    await interaction.reply({
      content: t('commands.keywords.remove.not_found', lang, { id: String(id) }),
      flags: ['Ephemeral'],
    });
    return;
  }

  const { keywords, totalPages } = await configService.getKeywordsPaginated(guildId, 1);
  const embed = buildKeywordsEmbed(keywords, lang, 1, totalPages);

  await interaction.reply({
    content: t('commands.keywords.remove.success', lang, { id: String(id) }),
    embeds: [embed],
    flags: ['Ephemeral'],
  });
}
