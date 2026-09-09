import {
  type ChatInputCommandInteraction,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import cron from 'node-cron';
import { configService } from '../../core/ConfigService.js';
import type { WatchService } from '../../core/WatchService.js';
import { t } from '../../i18n/index.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('cmd:watch');
import { buildStatusEmbed, buildUsageEmbed } from '../../utils/embeds.js';
import { AVAILABLE_SOURCES } from '../../sources/registry.js';
import { showApiKeyModal } from '../interactions/apiKeyModal.js';
import { fetchSerpApiAccount } from '../../sources/SerpApiScholar.js';

let watchService: WatchService | null = null;

export function setWatchService(ws: WatchService): void {
  watchService = ws;
}

export const data = new SlashCommandBuilder()
  .setName('watch')
  .setDescription('Configure bibliographic watch settings')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommandGroup((group) =>
    group
      .setName('channel')
      .setDescription('Manage watch channels')
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Add a notification channel')
          .addChannelOption((opt) =>
            opt
              .setName('channel')
              .setDescription('Target channel')
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildText),
          )
          .addStringOption((opt) =>
            opt.setName('name').setDescription('Optional label for this channel (e.g. "ants", "ecology")'),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove a notification channel')
          .addChannelOption((opt) =>
            opt
              .setName('channel')
              .setDescription('Channel to remove')
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildText),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName('list').setDescription('List all notification channels'),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName('schedule')
      .setDescription('Configure check schedule')
      .addSubcommand((sub) =>
        sub
          .setName('hour')
          .setDescription('Set daily check hour (UTC)')
          .addIntegerOption((opt) =>
            opt.setName('hour').setDescription('Hour (0-23)').setRequired(true).setMinValue(0).setMaxValue(23),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('cron')
          .setDescription('Set a custom cron schedule')
          .addStringOption((opt) =>
            opt.setName('expression').setDescription('Cron expression').setRequired(true),
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('language')
      .setDescription('Set the bot language for this server')
      .addStringOption((opt) =>
        opt
          .setName('lang')
          .setDescription('Language')
          .setRequired(true)
          .addChoices({ name: 'English', value: 'en' }, { name: 'Français', value: 'fr' }),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('sources')
      .setDescription('Choose which sources to use')
      .addStringOption((opt) =>
        opt
          .setName('source')
          .setDescription('Source to toggle')
          .setRequired(true)
          .addChoices(...AVAILABLE_SOURCES.map((s) => ({ name: s, value: s }))),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName('apikey')
      .setDescription('Manage SerpApi API key')
      .addSubcommand((sub) =>
        sub.setName('set').setDescription('Set your SerpApi API key'),
      )
      .addSubcommand((sub) =>
        sub.setName('usage').setDescription('Show SerpApi usage stats'),
      ),
  )
  .addSubcommand((sub) => sub.setName('toggle').setDescription('Enable or disable the watch'))
  .addSubcommand((sub) => sub.setName('status').setDescription('Show current watch configuration'))
  .addSubcommand((sub) =>
    sub.setName('run').setDescription('Force an immediate check (admin only)'),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = await configService.getOrCreateGuild(guildId);
  const lang = guild.language;

  const subgroup = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();

  logger.debug({ guildId, subgroup, sub, userId: interaction.user.id }, 'Command invoked');

  if (subgroup === 'channel' && sub === 'add') {
    const channel = interaction.options.getChannel('channel', true);
    const name = interaction.options.getString('name') ?? undefined;
    const wc = await configService.addWatchChannel(guildId, channel.id, name);
    if (!wc) {
      await interaction.reply({
        content: t('commands.watch.channel.already_exists', lang, { channel: `<#${channel.id}>` }),
        flags: ['Ephemeral'],
      });
      return;
    }
    await interaction.reply({
      content: t('commands.watch.channel.added', lang, { channel: `<#${channel.id}>` }),
      flags: ['Ephemeral'],
    });
    return;
  }

  if (subgroup === 'channel' && sub === 'remove') {
    const channel = interaction.options.getChannel('channel', true);
    const removed = await configService.removeWatchChannel(guildId, channel.id);
    if (!removed) {
      await interaction.reply({
        content: t('commands.watch.channel.not_found', lang, { channel: `<#${channel.id}>` }),
        flags: ['Ephemeral'],
      });
      return;
    }
    await interaction.reply({
      content: t('commands.watch.channel.removed', lang, { channel: `<#${channel.id}>` }),
      flags: ['Ephemeral'],
    });
    return;
  }

  if (subgroup === 'channel' && sub === 'list') {
    const watchChannels = await configService.getWatchChannels(guildId);
    if (watchChannels.length === 0) {
      await interaction.reply({
        content: t('commands.watch.channel.none', lang),
        flags: ['Ephemeral'],
      });
      return;
    }
    const lines = watchChannels.map((wc) => {
      const label = wc.name ? ` — *${wc.name}*` : '';
      return `• <#${wc.channelId}>${label} (${wc.keywords.length} ${t('commands.watch.channel.keywords_suffix', lang)})`;
    });
    await interaction.reply({
      content: `**${t('commands.watch.channel.list_title', lang)}**\n${lines.join('\n')}`,
      flags: ['Ephemeral'],
    });
    return;
  }

  if (subgroup === 'schedule' && sub === 'hour') {
    const hour = interaction.options.getInteger('hour', true);
    const cronExpr = `0 ${hour} * * *`;
    await configService.setCronSchedule(guildId, cronExpr);
    watchService?.scheduleGuild(guildId, cronExpr);
    await interaction.reply({
      content: t('commands.watch.schedule.hour.success', lang, { hour: String(hour) }),
      flags: ['Ephemeral'],
    });
    return;
  }

  if (subgroup === 'schedule' && sub === 'cron') {
    const expression = interaction.options.getString('expression', true);
    if (!cron.validate(expression)) {
      await interaction.reply({
        content: t('commands.watch.schedule.cron.invalid', lang),
        flags: ['Ephemeral'],
      });
      return;
    }
    await configService.setCronSchedule(guildId, expression);
    watchService?.scheduleGuild(guildId, expression);
    await interaction.reply({
      content: t('commands.watch.schedule.cron.success', lang, { cron: expression }),
      flags: ['Ephemeral'],
    });
    return;
  }

  if (subgroup === 'apikey' && sub === 'set') {
    await showApiKeyModal(interaction, lang);
    return;
  }

  if (subgroup === 'apikey' && sub === 'usage') {
    const apiKey = await configService.getSerpApiKey(guildId);
    if (!apiKey) {
      await interaction.reply({
        content: t('commands.watch.apikey.no_key', lang),
        flags: ['Ephemeral'],
      });
      return;
    }

    await interaction.deferReply({ flags: ['Ephemeral'] });

    const account = await fetchSerpApiAccount(apiKey);

    if (!account) {
      await interaction.editReply({ content: t('errors.generic', lang) });
      return;
    }

    const embed = buildUsageEmbed(account, lang);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === 'language') {
    const newLang = interaction.options.getString('lang', true);
    await configService.setLanguage(guildId, newLang);
    await interaction.reply({
      content: t('commands.watch.language.success', newLang, { language: newLang.toUpperCase() }),
      flags: ['Ephemeral'],
    });
    return;
  }

  if (sub === 'sources') {
    const source = interaction.options.getString('source', true);
    const current = configService.getSourceList(guild);
    let updated: string[];

    if (current.includes(source)) {
      updated = current.filter((s) => s !== source);
      if (updated.length === 0) {
        await interaction.reply({
          content: t('commands.watch.sources.min_one', lang),
          flags: ['Ephemeral'],
        });
        return;
      }
    } else {
      updated = [...current, source];
    }

    await configService.setSources(guildId, updated);
    const status = AVAILABLE_SOURCES.map((s) => `${updated.includes(s) ? '✅' : '❌'} ${s}`).join('\n');
    await interaction.reply({
      content: t('commands.watch.sources.updated', lang) + '\n' + status,
      flags: ['Ephemeral'],
    });
    return;
  }

  if (sub === 'toggle') {
    const updated = await configService.toggleEnabled(guildId);
    if (updated.enabled) {
      watchService?.scheduleGuild(guildId, updated.cronSchedule);
    } else {
      watchService?.unscheduleGuild(guildId);
    }
    const key = updated.enabled
      ? 'commands.watch.toggle.enabled'
      : 'commands.watch.toggle.disabled';
    await interaction.reply({ content: t(key, lang), flags: ['Ephemeral'] });
    return;
  }

  if (sub === 'status') {
    const watchChannels = await configService.getWatchChannels(guildId);
    const totalKeywords = watchChannels.reduce((sum, wc) => sum + wc.keywords.length, 0);
    const embed = buildStatusEmbed(
      {
        watchChannels: watchChannels.map((wc) => ({
          channelId: wc.channelId,
          name: wc.name,
          keywordsCount: wc.keywords.length,
        })),
        cronSchedule: guild.cronSchedule,
        language: guild.language,
        sources: configService.getSourceList(guild),
        enabled: guild.enabled,
        totalKeywords,
        hasSerpApiKey: guild.serpApiKey !== null,
      },
      lang,
    );
    await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
    return;
  }

  if (sub === 'run') {
    const watchChannels = await configService.getWatchChannels(guildId);
    if (watchChannels.length === 0) {
      await interaction.reply({
        content: t('commands.watch.run.no_channel', lang),
        flags: ['Ephemeral'],
      });
      return;
    }

    const totalKeywords = watchChannels.reduce((sum, wc) => sum + wc.keywords.length, 0);
    if (totalKeywords === 0) {
      await interaction.reply({
        content: t('commands.watch.run.no_keywords', lang),
        flags: ['Ephemeral'],
      });
      return;
    }

    await interaction.reply({
      content: t('commands.watch.run.started', lang),
      flags: ['Ephemeral'],
    });

    if (!watchService) return;
    const count = await watchService.runForGuild(guildId);
    const key = count > 0 ? 'commands.watch.run.completed' : 'commands.watch.run.no_results';
    await interaction.followUp({
      content: t(key, lang, { count: String(count) }),
      flags: ['Ephemeral'],
    });
  }
}
