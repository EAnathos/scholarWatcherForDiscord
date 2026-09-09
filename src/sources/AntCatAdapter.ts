import type { RawArticle } from '../core/DedupService.js';
import type { SourceAdapter } from './SourceAdapter.js';
import { prisma } from '../prisma/client.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('antcat');
import { fetchWithRetry } from '../utils/fetchWithRetry.js';

interface AntCatReferenceData {
  id: number;
  year: number;
  created_at: string;
  updated_at: string;
  title: string;
  author_names_string_cache: string;
  doi?: string | null;
}

type AntCatReference = Record<string, AntCatReferenceData>;

function getReferenceData(ref: AntCatReference): AntCatReferenceData | null {
  return ref.book_reference ?? ref.article_reference ?? null;
}

export class AntCatAdapter implements SourceAdapter {
  readonly name = 'antcat';

  async search(_keywords: string[], _since: Date, guildId: string): Promise<RawArticle[]> {
    const guild = await prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) return [];

    const lastRefId = guild.antcatLastRefId;
    logger.info({ guildId, lastRefId, source: this.name }, 'Searching from cursor');

    const url = `https://antcat.org/v1/references?starts_at=${lastRefId}`;
    const data = await fetchWithRetry<AntCatReference[]>(url, {
      headers: { Accept: 'application/json' },
      source: this.name,
    });

    if (!data || data.length === 0) return [];

    const articles: RawArticle[] = [];
    let maxId = lastRefId;

    for (const entry of data) {
      const ref = getReferenceData(entry);
      if (!ref) continue;

      if (ref.id > lastRefId) {
        articles.push({
          externalId: `antcat/${ref.id}`,
          source: this.name,
          title: ref.title,
          authors: ref.author_names_string_cache ?? null,
          year: ref.year,
          link: ref.doi ? `https://doi.org/${ref.doi}` : `https://antcat.org/references/${ref.id}`,
          doi: ref.doi ?? null,
        });
      }

      if (ref.id > maxId) {
        maxId = ref.id;
      }
    }

    if (maxId > lastRefId) {
      await prisma.guild.update({
        where: { id: guildId },
        data: { antcatLastRefId: maxId },
      });
      logger.info({ guildId, oldId: lastRefId, newId: maxId, source: this.name }, 'Cursor updated');
    }

    return articles.slice(0, 10);
  }
}

export const antCatAdapter = new AntCatAdapter();
