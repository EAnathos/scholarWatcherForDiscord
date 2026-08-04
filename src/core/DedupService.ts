import { prisma } from '../prisma/client.js';

export interface RawArticle {
  externalId: string;
  source: string;
  title: string;
  authors?: string | null;
  year?: number | null;
  link: string;
  doi?: string | null;
}

export class DedupService {
  async filterNew(guildId: string, articles: RawArticle[]): Promise<RawArticle[]> {
    if (articles.length === 0) return [];

    const externalIds = articles.map((a) => a.externalId);
    const existing = await prisma.article.findMany({
      where: { guildId, externalId: { in: externalIds } },
      select: { externalId: true },
    });

    const existingSet = new Set(existing.map((e) => e.externalId));
    return articles.filter((a) => !existingSet.has(a.externalId));
  }

  async markNotified(guildId: string, articles: RawArticle[]): Promise<void> {
    if (articles.length === 0) return;

    await prisma.article.createMany({
      data: articles.map((a) => ({
        guildId,
        externalId: a.externalId,
        source: a.source,
        title: a.title,
        authors: a.authors,
        year: a.year,
        link: a.link,
        doi: a.doi,
      })),
      skipDuplicates: true,
    });
  }
}

export const dedupService = new DedupService();
