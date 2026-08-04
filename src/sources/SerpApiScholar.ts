import { createHash } from 'node:crypto';
import type { RawArticle } from '../core/DedupService.js';
import type { SourceAdapter } from './SourceAdapter.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

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

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export class SerpApiScholar implements SourceAdapter {
  readonly name = 'serpapi';

  async search(keywords: string[], _since: Date): Promise<RawArticle[]> {
    if (keywords.length === 0) return [];

    const query = keywords.join(' OR ');
    const params = new URLSearchParams({
      engine: 'google_scholar',
      q: query,
      api_key: env.SERPAPI_KEY,
      as_ylo: String(new Date().getFullYear()),
      num: '10',
    });

    const url = `https://serpapi.com/search.json?${params.toString()}`;
    const data = await this.fetchWithRetry(url);

    if (data.error) {
      logger.error({ error: data.error, source: this.name }, 'SerpApi error');
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

  private async fetchWithRetry(url: string, attempt = 1): Promise<SerpApiResponse> {
    try {
      const response = await fetch(url);

      if (response.status === 429 && attempt <= MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        logger.warn({ attempt, delay, source: this.name }, 'Rate limited, retrying');
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, attempt + 1);
      }

      if (!response.ok) {
        throw new Error(`SerpApi HTTP ${response.status}`);
      }

      return (await response.json()) as SerpApiResponse;
    } catch (error) {
      if (attempt <= MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        logger.warn({ attempt, delay, error, source: this.name }, 'Fetch error, retrying');
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, attempt + 1);
      }
      logger.error({ error, source: this.name }, 'Fetch failed after retries');
      return {};
    }
  }
}

export const serpApiScholar = new SerpApiScholar();
