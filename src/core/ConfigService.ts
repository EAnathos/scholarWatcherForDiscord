import type { Guild, Keyword } from '@prisma/client';
import * as cron from 'node-cron';
import { prisma } from '../prisma/client.js';
import { encrypt, decrypt } from '../utils/crypto.js';

export const KEYWORDS_PER_PAGE = 25;

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

  async setChannel(guildId: string, channelId: string): Promise<Guild> {
    return prisma.guild.update({
      where: { id: guildId },
      data: { channelId },
    });
  }

  async setCronSchedule(guildId: string, cronSchedule: string): Promise<Guild> {
    if (!cron.validate(cronSchedule)) {
      throw new Error(`Invalid cron expression: ${cronSchedule}`);
    }
    return prisma.guild.update({
      where: { id: guildId },
      data: { cronSchedule },
    });
  }

  async setLanguage(guildId: string, language: string): Promise<Guild> {
    return prisma.guild.update({
      where: { id: guildId },
      data: { language },
    });
  }

  async toggleEnabled(guildId: string): Promise<Guild> {
    return prisma.$transaction(async (tx) => {
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
  }

  async setSources(guildId: string, sources: string[]): Promise<Guild> {
    return prisma.guild.update({
      where: { id: guildId },
      data: { sources: sources.join(',') },
    });
  }

  getSourceList(guild: Guild): string[] {
    return guild.sources.split(',').filter(Boolean);
  }

  async setSerpApiKey(guildId: string, apiKey: string): Promise<Guild> {
    return prisma.guild.update({
      where: { id: guildId },
      data: { serpApiKey: encrypt(apiKey) },
    });
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
  }

  async addKeyword(guildId: string, value: string): Promise<Keyword | null> {
    const existing = await prisma.keyword.findUnique({
      where: { guildId_value: { guildId, value } },
    });
    if (existing) return null;

    return prisma.keyword.create({
      data: { guildId, value },
    });
  }

  async removeKeyword(guildId: string, keywordId: number): Promise<boolean> {
    const { count } = await prisma.keyword.deleteMany({
      where: { id: keywordId, guildId },
    });
    return count > 0;
  }

  async getKeywords(guildId: string): Promise<Keyword[]> {
    return prisma.keyword.findMany({
      where: { guildId },
      orderBy: { id: 'asc' },
    });
  }

  async getKeywordsPaginated(
    guildId: string,
    page: number,
  ): Promise<{ keywords: Keyword[]; page: number; totalPages: number }> {
    const total = await prisma.keyword.count({ where: { guildId } });
    const totalPages = Math.max(1, Math.ceil(total / KEYWORDS_PER_PAGE));
    const safePage = Math.min(Math.max(1, page), totalPages);

    const keywords = await prisma.keyword.findMany({
      where: { guildId },
      orderBy: { id: 'asc' },
      skip: (safePage - 1) * KEYWORDS_PER_PAGE,
      take: KEYWORDS_PER_PAGE,
    });

    return { keywords, page: safePage, totalPages };
  }

  async getEnabledGuilds(): Promise<(Guild & { keywords: Keyword[] })[]> {
    return prisma.guild.findMany({
      where: { enabled: true, channelId: { not: null } },
      include: { keywords: true },
    });
  }
}

export const configService = new ConfigService();
