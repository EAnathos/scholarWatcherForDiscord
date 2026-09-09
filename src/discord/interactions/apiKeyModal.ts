import {
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { configService } from '../../core/ConfigService.js';
import { t } from '../../i18n/index.js';
import { fetchSerpApiAccount } from '../../sources/SerpApiScholar.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('modal:apikey');

export async function showApiKeyModal(
  interaction: ChatInputCommandInteraction,
  lang: string,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('apikey_set_modal')
    .setTitle(t('commands.watch.apikey.modal_title', lang));

  const input = new TextInputBuilder()
    .setCustomId('apikey_value')
    .setLabel(t('commands.watch.apikey.input_label', lang))
    .setPlaceholder(t('commands.watch.apikey.input_placeholder', lang))
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(100);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

export async function handleApiKeySubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = await configService.getOrCreateGuild(guildId);
  const lang = guild.language;
  const apiKey = interaction.fields.getTextInputValue('apikey_value').trim();

  await interaction.deferReply({ flags: ['Ephemeral'] });

  const account = await fetchSerpApiAccount(apiKey);

  if (!account?.plan_name) {
    logger.warn({ guildId }, 'Invalid API key submitted');
    await interaction.editReply({
      content: t('commands.watch.apikey.invalid', lang),
    });
    return;
  }

  await configService.setSerpApiKey(guildId, apiKey);
  logger.info({ guildId }, 'API key validated and saved');

  await interaction.editReply({
    content: t('commands.watch.apikey.success', lang),
  });
}
