import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { t } from '../i18n/index.js';
import { KEYWORDS_PER_PAGE } from '../core/ConfigService.js';
import type { SerpApiAccount } from '../sources/SerpApiScholar.js';

export interface ArticleData {
  title: string;
  authors?: string | null;
  link: string;
}

const EMBED_CHAR_LIMIT = 6000;
const FIELD_VALUE_LIMIT = 1024;

export function buildNotificationEmbed(articles: ArticleData[], lang: string): EmbedBuilder {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const date = new Date().toLocaleDateString(locale);
  const title = t('embeds.notification.title', lang);
  const footerText = `ScholarWatcher • ${date}`;
  const authorsLabel = t('embeds.notification.authors', lang);
  const linkLabel = t('embeds.notification.link', lang);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(0x4285f4)
    .setFooter({ text: footerText });

  let totalChars = title.length + footerText.length;

  for (const article of articles.slice(0, 25)) {
    const name = article.title.slice(0, 256);
    const parts: string[] = [];
    if (article.authors) {
      parts.push(`${authorsLabel}: ${article.authors}`);
    }
    const value = `${parts.join(' • ')}\n[${linkLabel}](${article.link})`.slice(0, FIELD_VALUE_LIMIT);

    if (totalChars + name.length + value.length > EMBED_CHAR_LIMIT) break;

    embed.addFields({ name, value });
    totalChars += name.length + value.length;
  }

  const addedCount = embed.data.fields?.length ?? 0;
  if (addedCount < articles.length) {
    const omitted = articles.length - addedCount;
    embed.setFooter({ text: `${footerText} • +${omitted} article(s)` });
  }

  return embed;
}

export function buildWelcomeEmbed(lang: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(t('embeds.welcome.title', lang))
    .setDescription(t('embeds.welcome.description', lang))
    .setColor(0x43b581);
}

export function buildKeywordsEmbed(
  keywords: { id: number; value: string }[],
  lang: string,
  page: number,
  totalPages: number,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(t('commands.keywords.list.title', lang))
    .setColor(0x7289da);

  if (keywords.length === 0) {
    embed.setDescription(t('commands.keywords.list.empty', lang));
  } else {
    const offset = (page - 1) * KEYWORDS_PER_PAGE;
    const list = keywords.map((kw, i) => `\`${offset + i + 1}\`. ${kw.value}`).join('\n');
    embed.setDescription(list);
  }

  if (totalPages > 1) {
    embed.setFooter({ text: t('commands.keywords.list.page', lang, { current: page, total: totalPages }) });
  }

  return embed;
}

export function buildKeywordsComponents(
  lang: string,
  page: number,
  totalPages: number,
): ActionRowBuilder<ButtonBuilder>[] {
  const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('kw_add')
      .setLabel(t('commands.keywords.add.button', lang))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('kw_remove')
      .setLabel(t('commands.keywords.remove.button', lang))
      .setStyle(ButtonStyle.Danger),
  );

  const components: ActionRowBuilder<ButtonBuilder>[] = [actions];

  if (totalPages > 1) {
    const pagination = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`kw_prev_${page}`)
        .setLabel('◀')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(`kw_next_${page}`)
        .setLabel('▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages),
    );
    components.push(pagination);
  }

  return components;
}

export function buildStatusEmbed(
  config: {
    channelId: string | null;
    cronSchedule: string;
    language: string;
    sources: string[];
    enabled: boolean;
    keywordsCount: number;
    hasSerpApiKey: boolean;
  },
  lang: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(t('commands.watch.status.title', lang))
    .setColor(config.enabled ? 0x43b581 : 0xf04747)
    .addFields(
      {
        name: t('commands.watch.status.channel', lang),
        value: config.channelId ? `<#${config.channelId}>` : t('commands.watch.status.not_set', lang),
        inline: true,
      },
      {
        name: t('commands.watch.status.schedule', lang),
        value: `\`${config.cronSchedule}\``,
        inline: true,
      },
      {
        name: t('commands.watch.status.language', lang),
        value: config.language.toUpperCase(),
        inline: true,
      },
      {
        name: t('commands.watch.status.sources', lang),
        value: config.sources.join(', '),
        inline: true,
      },
      {
        name: t('commands.watch.status.active', lang),
        value: config.enabled
          ? t('commands.watch.status.yes', lang)
          : t('commands.watch.status.no', lang),
        inline: true,
      },
      {
        name: t('commands.watch.status.keywords_count', lang),
        value: String(config.keywordsCount),
        inline: true,
      },
      {
        name: t('commands.watch.status.api_key', lang),
        value: config.hasSerpApiKey
          ? t('commands.watch.status.yes', lang)
          : t('commands.watch.status.no', lang),
        inline: true,
      },
    );
}

const BAR_LENGTH = 20;

function buildUsageBar(used: number, total: number): string {
  if (total <= 0) return '🟩'.repeat(BAR_LENGTH);
  const usedBlocks = Math.round((used / total) * BAR_LENGTH);
  const remainingBlocks = BAR_LENGTH - usedBlocks;
  return '🟥'.repeat(usedBlocks) + '🟩'.repeat(remainingBlocks);
}

export function buildUsageEmbed(account: SerpApiAccount, lang: string): EmbedBuilder {
  const used = account.this_month_usage ?? 0;
  const remaining = account.total_searches_left ?? 0;
  const total = used + remaining;
  const bar = buildUsageBar(used, total);

  return new EmbedBuilder()
    .setTitle(t('commands.watch.apikey.usage_title', lang))
    .setColor(0x4285f4)
    .addFields(
      {
        name: t('commands.watch.apikey.plan', lang),
        value: account.plan_name ?? '—',
        inline: true,
      },
    )
    .setDescription(`${bar}\n**${remaining}** / ${total} ${t('commands.watch.apikey.remaining', lang).toLowerCase()}`);
}
