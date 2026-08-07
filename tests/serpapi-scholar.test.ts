import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubEnv('DISCORD_TOKEN', 'test');
vi.stubEnv('DISCORD_APP_ID', 'test');
vi.stubEnv('ENCRYPTION_KEY', '0'.repeat(64));
vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
vi.stubEnv('LOG_LEVEL', 'error');

vi.mock('../src/core/ConfigService.js', () => ({
  configService: {
    getSerpApiKey: vi.fn().mockResolvedValue('fake-serpapi-key'),
  },
}));

const { SerpApiScholar } = await import('../src/sources/SerpApiScholar.js');
const { configService } = await import('../src/core/ConfigService.js');
const mockGetSerpApiKey = vi.mocked(configService.getSerpApiKey);

describe('SerpApiScholar', () => {
  const adapter = new SerpApiScholar();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should have name "serpapi"', () => {
    expect(adapter.name).toBe('serpapi');
  });

  it('should return empty array for empty keywords', async () => {
    const result = await adapter.search([], new Date(), 'guild1');
    expect(result).toEqual([]);
  });

  it('should return empty array when no API key configured', async () => {
    mockGetSerpApiKey.mockResolvedValueOnce(null);
    const result = await adapter.search(['test'], new Date(), 'guild1');
    expect(result).toEqual([]);
  });

  it('should map SerpApi results to RawArticle format', async () => {
    const mockResponse = {
      organic_results: [
        {
          title: 'Test Article',
          link: 'https://example.com/article',
          result_id: 'abc123',
          publication_info: {
            summary: 'Journal of Testing, 2024',
            authors: [{ name: 'John Doe' }, { name: 'Jane Smith' }],
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const results = await adapter.search(['test'], new Date(), 'guild1');

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      externalId: 'abc123',
      source: 'serpapi',
      title: 'Test Article',
      authors: 'John Doe, Jane Smith',
      year: 2024,
      link: 'https://example.com/article',
      doi: null,
    });
  });

  it('should handle API errors gracefully', async () => {
    const mockResponse = { error: 'Invalid API key' };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const results = await adapter.search(['test'], new Date(), 'guild1');
    expect(results).toEqual([]);
  });

  it('should generate externalId from hash when result_id is missing', async () => {
    const mockResponse = {
      organic_results: [
        {
          title: 'No ID Article',
          link: 'https://example.com/no-id',
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const results = await adapter.search(['test'], new Date(), 'guild1');

    expect(results).toHaveLength(1);
    expect(results[0].externalId).toMatch(/^scholar\//);
  });
});
