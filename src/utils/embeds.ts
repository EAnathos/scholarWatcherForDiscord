import { EmbedBuilder } from 'discord.js';
import { t } from '../i18n/index.js';

export interface ArticleData {
  title: string;
  authors?: string | null;
  year?: number | null;
  link: string;
  source: string;
}

export function buildNotificationEmbed(articles: ArticleData[], lang: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(t('embeds.notification.title', lang))
    .setColor(0x4285f4)
    .setFooter({
      text: t('embeds.notification.footer', lang, { date: new Date().toLocaleDateString() }),
    })
    .setTimestamp();

  for (const article of articles.slice(0, 10)) {
    const parts: string[] = [];
    if (article.authors) {
      parts.push(`${t('embeds.notification.authors', lang)}: ${article.authors}`);
    }
    if (article.year) {
      parts.push(`${t('embeds.notification.year', lang)}: ${article.year}`);
    }
    parts.push(`${t('embeds.notification.source', lang)}: ${article.source}`);

    embed.addFields({
      name: article.title.slice(0, 256),
      value: `${parts.join(' • ')}\n[Link](${article.link})`,
    });
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
    const list = keywords.map((kw) => `\`${kw.id}\`. ${kw.value}`).join('\n');
    embed.setDescription(list);
  }

  const footerParts = [t('commands.keywords.list.footer', lang, { count: keywords.length })];
  if (totalPages > 1) {
    footerParts.push(t('commands.keywords.list.page', lang, { current: page, total: totalPages }));
  }
  embed.setFooter({ text: footerParts.join(' • ') });

  return embed;
}

export function buildStatusEmbed(
  config: {
    channelId: string | null;
    cronSchedule: string;
    language: string;
    enabled: boolean;
    keywordsCount: number;
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
    );
}
