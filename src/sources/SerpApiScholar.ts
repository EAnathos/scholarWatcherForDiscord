import { createHash } from 'node:crypto';
import type { RawArticle } from '../core/DedupService.js';
import type { SourceAdapter } from './SourceAdapter.js';
import { configService } from '../core/ConfigService.js';
import { logger } from '../utils/logger.js';
import { fetchWithRetry } from '../utils/fetchWithRetry.js';

interface SerpApiOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  publication_info?: {
    summary?: string;
    authors?: { name?: string }[];
  };
  inline_links?: {
    cited_by?: { total?: number; link?: string };
  };
  result_id?: string;
}

interface SerpApiResponse {
  organic_results?: SerpApiOrganicResult[];
  error?: string;
}

export interface SerpApiAccount {
  plan_name?: string;
  total_searches_left?: number;
  this_month_usage?: number;
  this_hour_usage?: number;
  account_email?: string;
}

export class SerpApiScholar implements SourceAdapter {
  readonly name = 'serpapi';

  async search(keywords: string[], _since: Date, guildId: string): Promise<RawArticle[]> {
    if (keywords.length === 0) return [];

    const apiKey = await configService.getSerpApiKey(guildId);
    if (!apiKey) {
      logger.warn({ guildId, source: this.name }, 'No API key configured');
      return [];
    }

    const query = keywords.join(' OR ');
    const params = new URLSearchParams({
      engine: 'google_scholar',
      q: query,
      api_key: apiKey,
      scisbd: '1',
      num: '10',
    });

    const url = `https://serpapi.com/search.json?${params.toString()}`;
    const data = await fetchWithRetry<SerpApiResponse>(url, { source: this.name });

    if (!data || data.error) {
      if (data?.error) logger.error({ error: data.error, source: this.name }, 'SerpApi error');
      return [];
    }

    return (data.organic_results ?? [])
      .filter((result) => result.link)
      .map((result) => this.mapResult(result));
  }

  private mapResult(result: SerpApiOrganicResult): RawArticle {
    const title = result.title ?? 'Untitled';
    const link = result.link ?? '';
    const externalId =
      result.result_id ??
      `scholar/${createHash('sha256').update(`${title}|${link}`).digest('hex').slice(0, 16)}`;

    const authors = result.publication_info?.authors?.map((a) => a.name).join(', ') ?? null;

    let year: number | null = null;
    const summaryMatch = result.publication_info?.summary?.match(/\b(19|20)\d{2}\b/);
    if (summaryMatch) {
      year = parseInt(summaryMatch[0], 10);
    }

    return {
      externalId,
      source: this.name,
      title,
      authors,
      year,
      link,
      doi: null,
    };
  }
}

export const serpApiScholar = new SerpApiScholar();
