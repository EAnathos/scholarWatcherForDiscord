import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubEnv('DISCORD_TOKEN', 'test');
vi.stubEnv('DISCORD_APP_ID', 'test');
vi.stubEnv('SERPAPI_KEY', 'test-key');
vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/scholarwatch');
vi.stubEnv('LOG_LEVEL', 'error');

vi.mock('../src/prisma/client.js', () => ({
  prisma: {
    guild: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const { AntCatAdapter } = await import('../src/sources/AntCatAdapter.js');
const { prisma } = await import('../src/prisma/client.js');

describe('AntCatAdapter', () => {
  const adapter = new AntCatAdapter();
  const mockGuild = vi.mocked(prisma.guild);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should have name "antcat"', () => {
    expect(adapter.name).toBe('antcat');
  });

  it('should return empty array without guildId', async () => {
    const result = await adapter.search([], new Date());
    expect(result).toEqual([]);
  });

  it('should return empty array if guild not found', async () => {
    mockGuild.findUnique.mockResolvedValueOnce(null);
    const result = await adapter.search(['test'], new Date(), 'unknown');
    expect(result).toEqual([]);
  });

  it('should fetch references starting from cursor and return new ones', async () => {
    mockGuild.findUnique.mockResolvedValueOnce({
      id: 'guild1',
      antcatLastRefId: 100,
      channelId: '#ch',
      cronSchedule: '0 4 * * *',
      language: 'en',
      sources: 'antcat',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockGuild.update.mockResolvedValueOnce({} as never);

    const mockResponse = [
      {
        article_reference: {
          id: 101,
          year: 2026,
          created_at: '2026-07-01T00:00:00.000Z',
          updated_at: '2026-07-01T00:00:00.000Z',
          title: 'New ant species',
          author_names_string_cache: 'Smith, J.',
          doi: '10.1234/test',
        },
      },
      {
        book_reference: {
          id: 100,
          year: 2025,
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z',
          title: 'Already seen reference',
          author_names_string_cache: 'Old, A.',
          doi: null,
        },
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const results = await adapter.search(['Formicidae'], new Date(), 'guild1');

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      externalId: 'antcat/101',
      source: 'antcat',
      title: 'New ant species',
      authors: 'Smith, J.',
      year: 2026,
      link: 'https://doi.org/10.1234/test',
      doi: '10.1234/test',
    });

    expect(mockGuild.update).toHaveBeenCalledWith({
      where: { id: 'guild1' },
      data: { antcatLastRefId: 101 },
    });
  });

  it('should use antcat.org link when no DOI', async () => {
    mockGuild.findUnique.mockResolvedValueOnce({
      id: 'guild1',
      antcatLastRefId: 50,
      channelId: '#ch',
      cronSchedule: '0 4 * * *',
      language: 'en',
      sources: 'antcat',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockGuild.update.mockResolvedValueOnce({} as never);

    const mockResponse = [
      {
        article_reference: {
          id: 51,
          year: 2026,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          title: 'No DOI paper',
          author_names_string_cache: 'Author, X.',
          doi: null,
        },
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const results = await adapter.search(['test'], new Date(), 'guild1');
    expect(results[0].link).toBe('https://antcat.org/references/51');
  });
});
