import type { Guild, Keyword, WatchChannel } from '@prisma/client';
import * as cron from 'node-cron';
import { prisma } from '../prisma/client.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('config');

export const KEYWORDS_PER_PAGE = 25;

export type WatchChannelWithKeywords = WatchChannel & { keywords: Keyword[] };

export class ConfigService {
  async getOrCreateGuild(guildId: string): Promise<Guild> {
    return prisma.guild.upsert({
      where: { id: guildId },
      create: { id: guildId },
      update: {},
    });
  }

  async getGuild(guildId: string): Promise<Guild | null> {
    return prisma.guild.findUnique({ where: { id: guildId } });
  }

  async addWatchChannel(guildId: string, channelId: string, name?: string): Promise<WatchChannel | null> {
    const existing = await prisma.watchChannel.findUnique({
      where: { guildId_channelId: { guildId, channelId } },
    });
    if (existing) return null;

    const wc = await prisma.watchChannel.create({
      data: { guildId, channelId, name },
    });
    logger.info({ guildId, channelId, name }, 'Watch channel added');
    return wc;
  }

  async removeWatchChannel(guildId: string, channelId: string): Promise<boolean> {
    const { count } = await prisma.watchChannel.deleteMany({
      where: { guildId, channelId },
    });
    if (count > 0) logger.info({ guildId, channelId }, 'Watch channel removed');
    return count > 0;
  }

  async getWatchChannels(guildId: string): Promise<WatchChannelWithKeywords[]> {
    return prisma.watchChannel.findMany({
      where: { guildId },
      include: { keywords: true },
      orderBy: { id: 'asc' },
    });
  }

  async getWatchChannel(guildId: string, channelId: string): Promise<WatchChannel | null> {
    return prisma.watchChannel.findUnique({
      where: { guildId_channelId: { guildId, channelId } },
    });
  }

  async setCronSchedule(guildId: string, cronSchedule: string): Promise<Guild> {
    if (!cron.validate(cronSchedule)) {
      throw new Error(`Invalid cron expression: ${cronSchedule}`);
    }
    const guild = await prisma.guild.update({
      where: { id: guildId },
      data: { cronSchedule },
    });
    logger.info({ guildId, cronSchedule }, 'Cron schedule updated');
    return guild;
  }

  async setLanguage(guildId: string, language: string): Promise<Guild> {
    const guild = await prisma.guild.update({
      where: { id: guildId },
      data: { language },
    });
    logger.info({ guildId, language }, 'Language updated');
    return guild;
  }

  async toggleEnabled(guildId: string): Promise<Guild> {
    const updated = await prisma.$transaction(async (tx) => {
      const guild = await tx.guild.upsert({
        where: { id: guildId },
        create: { id: guildId },
        update: {},
      });
      return tx.guild.update({
        where: { id: guildId },
        data: { enabled: !guild.enabled },
      });
    });
    logger.info({ guildId, enabled: updated.enabled }, 'Guild toggled');
    return updated;
  }

  async setSources(guildId: string, sources: string[]): Promise<Guild> {
    const guild = await prisma.guild.update({
      where: { id: guildId },
      data: { sources: sources.join(',') },
    });
    logger.info({ guildId, sources }, 'Sources updated');
    return guild;
  }

  getSourceList(guild: Guild): string[] {
    return guild.sources.split(',').filter(Boolean);
  }

  async setSerpApiKey(guildId: string, apiKey: string): Promise<Guild> {
    const guild = await prisma.guild.update({
      where: { id: guildId },
      data: { serpApiKey: encrypt(apiKey) },
    });
    logger.info({ guildId }, 'SerpApi key updated');
    return guild;
  }

  async getSerpApiKey(guildId: string): Promise<string | null> {
    const guild = await this.getGuild(guildId);
    if (!guild?.serpApiKey) return null;
    return decrypt(guild.serpApiKey);
  }

  async disableGuild(guildId: string): Promise<void> {
    await prisma.guild.update({
      where: { id: guildId },
      data: { enabled: false },
    });
    logger.info({ guildId }, 'Guild disabled');
  }

  async addKeyword(watchChannelId: number, value: string): Promise<Keyword | null> {
    const existing = await prisma.keyword.findUnique({
      where: { watchChannelId_value: { watchChannelId, value } },
    });
    if (existing) return null;

    const keyword = await prisma.keyword.create({
      data: { watchChannelId, value },
    });
    logger.info({ watchChannelId, value }, 'Keyword added');
    return keyword;
  }

  async removeKeyword(watchChannelId: number, keywordId: number): Promise<boolean> {
    const { count } = await prisma.keyword.deleteMany({
      where: { id: keywordId, watchChannelId },
    });
    if (count > 0) logger.info({ watchChannelId, keywordId }, 'Keyword removed');
    return count > 0;
  }

  async getKeywords(watchChannelId: number): Promise<Keyword[]> {
    return prisma.keyword.findMany({
      where: { watchChannelId },
      orderBy: { id: 'asc' },
    });
  }

  async getKeywordsPaginated(
    watchChannelId: number,
    page: number,
  ): Promise<{ keywords: Keyword[]; page: number; totalPages: number }> {
    const total = await prisma.keyword.count({ where: { watchChannelId } });
    const totalPages = Math.max(1, Math.ceil(total / KEYWORDS_PER_PAGE));
    const safePage = Math.min(Math.max(1, page), totalPages);

    const keywords = await prisma.keyword.findMany({
      where: { watchChannelId },
      orderBy: { id: 'asc' },
      skip: (safePage - 1) * KEYWORDS_PER_PAGE,
      take: KEYWORDS_PER_PAGE,
    });

    return { keywords, page: safePage, totalPages };
  }

  async getEnabledGuilds(): Promise<(Guild & { watchChannels: WatchChannelWithKeywords[] })[]> {
    return prisma.guild.findMany({
      where: {
        enabled: true,
        watchChannels: { some: {} },
      },
      include: {
        watchChannels: {
          include: { keywords: true },
        },
      },
    });
  }
}

export const configService = new ConfigService();
