import type { Client } from 'discord.js';
import * as cron from 'node-cron';
import { configService } from './ConfigService.js';
import { dedupService } from './DedupService.js';
import type { RawArticle } from './DedupService.js';
import { getAdapters } from '../sources/registry.js';
import { buildNotificationEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';

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

    if (!guild?.enabled || !guild.channelId) {
      logger.debug({ guildId }, 'Guild disabled or no channel, skipping');
      return 0;
    }

    const keywords = await configService.getKeywords(guildId);
    if (keywords.length === 0) {
      logger.debug({ guildId }, 'No keywords, skipping');
      return 0;
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const keywordValues = keywords.map((k) => k.value);
    const sourceKeys = configService.getSourceList(guild);
    const adapters = getAdapters(sourceKeys);

    logger.info({ guildId, keywords: keywordValues.length, sources: sourceKeys }, 'Running search');

    const allRawArticles: RawArticle[] = [];
    for (const adapter of adapters) {
      try {
        const results = await adapter.search(keywordValues, since, guildId);
        allRawArticles.push(...results);
      } catch (error) {
        logger.error({ guildId, source: adapter.name, error }, 'Source search failed');
      }
    }

    const newArticles = await dedupService.filterNew(guildId, allRawArticles);

    if (newArticles.length === 0) {
      logger.info({ guildId, elapsed_ms: Date.now() - startTime }, 'No new articles');
      return 0;
    }

    const channel = await this.client.channels.fetch(guild.channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased()) {
      logger.warn({ guildId, channelId: guild.channelId }, 'Channel not found or not a text channel');
      await dedupService.markNotified(guildId, newArticles);
      return 0;
    }

    try {
      const embed = buildNotificationEmbed(newArticles, guild.language);
      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error({ guildId, error }, 'Failed to send notification');
    }

    await dedupService.markNotified(guildId, newArticles);

    return newArticles.length;
  }
}
