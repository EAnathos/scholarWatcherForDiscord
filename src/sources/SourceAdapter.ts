import type { RawArticle } from '../core/DedupService.js';

export interface SourceAdapter {
  readonly name: string;
  search(keywords: string[], since: Date): Promise<RawArticle[]>;
}
