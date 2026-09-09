import { prisma } from '../prisma/client.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('dedup');

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
    const newArticles = articles.filter((a) => !existingSet.has(a.externalId));
    logger.debug({ guildId, total: articles.length, new: newArticles.length, duplicates: existingSet.size }, 'Dedup completed');
    return newArticles;
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
    logger.debug({ guildId, count: articles.length }, 'Articles marked as notified');
  }
}

export const dedupService = new DedupService();
