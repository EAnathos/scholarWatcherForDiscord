import type { Guild, Keyword } from '@prisma/client';
import { prisma } from '../prisma/client.js';

const KEYWORDS_PER_PAGE = 25;

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
    const guild = await this.getOrCreateGuild(guildId);
    return prisma.guild.update({
      where: { id: guildId },
      data: { enabled: !guild.enabled },
    });
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
    const keyword = await prisma.keyword.findFirst({
      where: { id: keywordId, guildId },
    });
    if (!keyword) return false;

    await prisma.keyword.delete({ where: { id: keywordId } });
    return true;
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
  ): Promise<{ keywords: Keyword[]; totalPages: number }> {
    const total = await prisma.keyword.count({ where: { guildId } });
    const totalPages = Math.max(1, Math.ceil(total / KEYWORDS_PER_PAGE));
    const safePage = Math.min(Math.max(1, page), totalPages);

    const keywords = await prisma.keyword.findMany({
      where: { guildId },
      orderBy: { id: 'asc' },
      skip: (safePage - 1) * KEYWORDS_PER_PAGE,
      take: KEYWORDS_PER_PAGE,
    });

    return { keywords, totalPages };
  }

  async getEnabledGuilds(): Promise<(Guild & { keywords: Keyword[] })[]> {
    return prisma.guild.findMany({
      where: { enabled: true, channelId: { not: null } },
      include: { keywords: true },
    });
  }
}

export const configService = new ConfigService();
