import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { configService } from '../../core/ConfigService.js';
import { t } from '../../i18n/index.js';

const WIKI_URL = 'https://github.com/EAnathos/scholarWatcherForDiscord/wiki';
const PRIVACY_URL = 'https://eanathos.github.io/scholarWatcherForDiscord/privacy.html';
const TOS_URL = 'https://eanathos.github.io/scholarWatcherForDiscord/tos.html';
const REPO_URL = 'https://github.com/EAnathos/scholarWatcherForDiscord';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show bot commands and useful links');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = await configService.getOrCreateGuild(guildId);
  const lang = guild.language;

  const embed = new EmbedBuilder()
    .setTitle(t('commands.help.title', lang))
    .setDescription(t('commands.help.description', lang))
    .addFields(
      {
        name: t('commands.help.fields.getting_started', lang),
        value: [
          '`/watch apikey set` — ' + t('commands.help.fields.apikey_desc', lang),
          '`/watch channel add #channel` — ' + t('commands.help.fields.channel_add_desc', lang),
          '`/keywords` — ' + t('commands.help.fields.keywords_desc', lang),
          '`/watch toggle` — ' + t('commands.help.fields.toggle_desc', lang),
        ].join('\n'),
      },
      {
        name: t('commands.help.fields.configuration', lang),
        value: [
          '`/watch status` — ' + t('commands.help.fields.status_desc', lang),
          '`/watch schedule hour <0-23>` — ' + t('commands.help.fields.schedule_desc', lang),
          '`/watch language <en|fr>` — ' + t('commands.help.fields.language_desc', lang),
          '`/watch sources <source>` — ' + t('commands.help.fields.sources_desc', lang),
          '`/watch run` — ' + t('commands.help.fields.run_desc', lang),
        ].join('\n'),
      },
      {
        name: t('commands.help.fields.links', lang),
        value: [
          `[${t('commands.help.fields.documentation', lang)}](${WIKI_URL})`,
          `[${t('commands.help.fields.source_code', lang)}](${REPO_URL})`,
          `[${t('commands.help.fields.privacy_policy', lang)}](${PRIVACY_URL})`,
          `[${t('commands.help.fields.terms_of_service', lang)}](${TOS_URL})`,
        ].join(' · '),
      },
    )
    .setColor(0x5865f2);

  await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
}
