import type { Client } from 'discord.js';
import * as cron from 'node-cron';
import { configService } from './ConfigService.js';
import type { WatchChannelWithKeywords } from './ConfigService.js';
import { dedupService } from './DedupService.js';
import type { RawArticle } from './DedupService.js';
import { getAdapters } from '../sources/registry.js';
import { buildNotificationEmbed } from '../utils/embeds.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('watch');

const scheduledTasks = new Map<string, cron.ScheduledTask>();

export class WatchService {
  constructor(private client: Client) {}

  async scheduleAll(): Promise<void> {
    for (const task of scheduledTasks.values()) {
      task.stop();
    }
    scheduledTasks.clear();

    const guilds = await configService.getEnabledGuilds();

    for (const guild of guilds) {
      this.scheduleGuild(guild.id, guild.cronSchedule);
    }

    logger.info({ count: guilds.length }, 'Scheduled watch tasks');
  }

  scheduleGuild(guildId: string, cronExpression: string): void {
    const existing = scheduledTasks.get(guildId);
    if (existing) existing.stop();

    if (!cron.validate(cronExpression)) {
      logger.error({ guildId, cronExpression }, 'Invalid cron expression');
      return;
    }

    const task = cron.schedule(cronExpression, () => {
      void this.runForGuild(guildId);
    });

    scheduledTasks.set(guildId, task);
    logger.info({ guildId, cronExpression }, 'Scheduled guild watch');
  }

  unscheduleGuild(guildId: string): void {
    const task = scheduledTasks.get(guildId);
    if (task) {
      task.stop();
      scheduledTasks.delete(guildId);
    }
  }

  async runForGuild(guildId: string): Promise<number> {
    const startTime = Date.now();
    const guild = await configService.getGuild(guildId);

    if (!guild?.enabled) {
      logger.debug({ guildId }, 'Guild disabled, skipping');
      return 0;
    }

    const watchChannels = await configService.getWatchChannels(guildId);
    if (watchChannels.length === 0) {
      logger.debug({ guildId }, 'No watch channels, skipping');
      return 0;
    }

    const sourceKeys = configService.getSourceList(guild);
    const adapters = getAdapters(sourceKeys);
    let totalNew = 0;

    for (const wc of watchChannels) {
      const count = await this.runForChannel(guildId, wc, sourceKeys, adapters, guild.language);
      totalNew += count;
    }

    logger.info({ guildId, totalNew, elapsed_ms: Date.now() - startTime }, 'Guild run complete');
    return totalNew;
  }

  private async runForChannel(
    guildId: string,
    wc: WatchChannelWithKeywords,
    sourceKeys: string[],
    adapters: ReturnType<typeof getAdapters>,
    language: string,
  ): Promise<number> {
    if (wc.keywords.length === 0) {
      logger.debug({ guildId, channelId: wc.channelId }, 'No keywords for channel, skipping');
      return 0;
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const keywordValues = wc.keywords.map((k) => k.value);

    logger.info({ guildId, channelId: wc.channelId, keywords: keywordValues.length, sources: sourceKeys }, 'Running search for channel');

    const allRawArticles: RawArticle[] = [];
    for (const adapter of adapters) {
      try {
        const results = await adapter.search(keywordValues, since, guildId);
        allRawArticles.push(...results);
      } catch (error) {
        logger.error({ guildId, channelId: wc.channelId, source: adapter.name, error }, 'Source search failed');
      }
    }

    const newArticles = await dedupService.filterNew(guildId, allRawArticles);

    if (newArticles.length === 0) {
      logger.info({ guildId, channelId: wc.channelId }, 'No new articles for channel');
      return 0;
    }

    const channel = await this.client.channels.fetch(wc.channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased()) {
      logger.warn({ guildId, channelId: wc.channelId }, 'Channel not found or not a text channel');
      await dedupService.markNotified(guildId, newArticles);
      return 0;
    }

    try {
      const embed = buildNotificationEmbed(newArticles, language);
      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error({ guildId, channelId: wc.channelId, error }, 'Failed to send notification');
    }

    await dedupService.markNotified(guildId, newArticles);
    return newArticles.length;
  }
}
