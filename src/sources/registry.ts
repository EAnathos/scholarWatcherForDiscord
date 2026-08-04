import type { SourceAdapter } from './SourceAdapter.js';
import { serpApiScholar } from './SerpApiScholar.js';
import { antCatAdapter } from './AntCatAdapter.js';

const adapters = new Map<string, SourceAdapter>();
adapters.set('serpapi', serpApiScholar);
adapters.set('antcat', antCatAdapter);

export const AVAILABLE_SOURCES = [...adapters.keys()];

export function getAdapters(sourceKeys: string[]): SourceAdapter[] {
  return sourceKeys
    .map((key) => adapters.get(key))
    .filter((a): a is SourceAdapter => a !== undefined);
}
